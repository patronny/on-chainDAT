// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {LineaDATHook} from "../src/LineaDATHook.sol";
import {LineaDATSeeder} from "../src/LineaDATSeeder.sol";
import {ILineaDATFactory} from "../src/Interfaces.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @notice LineaDAT Phase 4 mainnet launch on Linea (chainId 59144).
///
/// Mirrors the Phase 3.5 testnet `LaunchLineaDAT.s.sol` flow but with:
///   - Linea v4 canonical addresses (PoolManager, UniversalRouter)
///   - Real $LINEA underlying (canonical Consensys token)
///   - Keycard EOA as owner (transfer at the end of the script)
///   - 0x6e0d... default for FEE_ADDRESS (creator wallet, 2% of swap volume)
///   - No LineaDATTestSwapper, no Faucet (mainnet has no testnet helpers)
///
/// PRE-FLIGHT CHECKLIST:
///   1. Deployer hot EOA funded with >= 0.05 ETH on Linea (gas + 0.6 ETH bot funding optional)
///   2. Deployer is allowed-listed for Etherscan/Sourcify verification flows post-deploy
///   3. Set SCHEDULED_LAUNCH_TIME (unix ts) for delayed-launch gate (recommended)
///   4. Anvil fork test pass on `https://rpc.linea.build`
///   5. Slither + Aderyn green
///   6. Frontend `wagmi.ts` env vars updated immediately after deploy
///
/// ENV VARS:
///   PRIVATE_KEY              Hot EOA deployer (also temp owner during atomic setup)
///   FEE_ADDRESS              Creator fee recipient (default 0x6e0d... per docs/50-lineadat-spec.md)
///   OWNER_FINAL              Final owner after handover (default Keycard EOA per spec)
///   KEEPER                   Bot keeper EOA (default Keycard - safe but slow; rotate via setKeeper)
///   SCHEDULED_LAUNCH_TIME    Unix ts for delayed launch gate (optional; 0 = open immediately)
///
/// USAGE:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url https://rpc.linea.build --broadcast --private-key $PRIVATE_KEY -vvvv
///
/// POST-DEPLOY (manual):
///   - Verify on Lineascan (forge verify-contract for impl/factory/hook/bot/seeder)
///   - Fund bot with $LINEA (~1.5M minimum) and ETH (~0.6) from creator wallet
///   - Update Discord webhook + frontend env
contract Deploy is Script {
    /* === Linea mainnet constants === */
    address constant POOL_MANAGER = 0x248083Fb965359d82b06C1F5322480Dcfc1AD857;
    address constant UNIVERSAL_ROUTER = 0x8B844f885672f333Bc0042cB669255f93a4C1E6b; // V2_1_1
    address constant LINEA_TOKEN = 0x1789e0043623282D5DCc7F213d703C6D8BAfBB04; // canonical Consensys
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /* === LineaDAT economic params ===
       Defaults = full real-launch values (per docs/50-lineadat-spec.md).
       All overridable via env for the scaled Linea-mainnet rehearsal (TestDAT, /100)
       so the real launch reuses this script with NO code revert (just omit the env).
       TOTAL_SUPPLY is never scaled - MAX_SUPPLY is a contract constant (1B). */
    uint256 constant DEFAULT_BAG_SIZE = 150_000 * 1e18;
    uint256 constant DEFAULT_BUY_INCREMENT = 0.005 ether; // FINAL launch value (2026-06-01): stretched 4x below 0.02 for a smooth ~4-6 min/bag drip; IMMUTABLE post-deploy (no setter)
    uint256 constant DEFAULT_TWAP_INCREMENT = 0.05 ether;
    uint256 constant DEFAULT_TWAP_DELAY_BLOCKS = 4;
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    /* === Default principals (overridable via env) === */
    address constant DEFAULT_OWNER_FINAL = 0x1470c542D60e83EcCFE005332f5789Bd669D027C; // Keycard EOA
    address constant DEFAULT_FEE_ADDRESS = 0x6e0d01089976093680c881CcDcB79e0D046e2433; // creator wallet

    /* === Pool config === */
    int24 constant TICK_LOWER = -887220;
    int24 constant TICK_UPPER = 175020;
    int24 constant TICK_SPACING = 60;
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;

    /* === Hook permission flags === */
    uint160 constant REQUIRED_FLAGS = 0x2444; // BEFORE_INIT | AFTER_ADD_LIQ | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA
    uint256 constant MAX_SALT = 200_000;

    function run() external {
        require(block.chainid == 59144, "Must be on Linea mainnet (chainId 59144)");

        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        uint64 currentNonce = vm.getNonce(deployer);

        // FEE_ADDRESS = recipient of full 20% creator share on the LineaDAT self-launch.
        //   - feeds hook.feeAddress (10% LineaDAT-burn redirect; constructor arg)
        //   - feeds hook.feeAddressClaimedByOwner[proxy] (10% creator share; admin call post-deploy)
        // Default 0x6e0d... per spec.
        address creatorFeeAddr = vm.envOr("FEE_ADDRESS", DEFAULT_FEE_ADDRESS);
        address ownerFinal = vm.envOr("OWNER_FINAL", DEFAULT_OWNER_FINAL);
        address keeper = vm.envOr("KEEPER", ownerFinal);

        // Economic params + token identity: default to the full real-launch values; override
        // via env for the scaled rehearsal (TestDAT, /100). buyIncrement is LOCKED at initialize
        // (no post-deploy setter) so it MUST be correct here before broadcast.
        uint256 bagSize = vm.envOr("BAG_SIZE", DEFAULT_BAG_SIZE);
        uint256 buyIncrement = vm.envOr("BUY_INCREMENT", DEFAULT_BUY_INCREMENT);
        uint256 twapIncrement = vm.envOr("TWAP_INCREMENT", DEFAULT_TWAP_INCREMENT);
        uint256 twapDelayBlocks = vm.envOr("TWAP_DELAY_BLOCKS", DEFAULT_TWAP_DELAY_BLOCKS);
        string memory tokenName = vm.envOr("TOKEN_NAME", string("LineaDAT"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("LINEADAT"));

        console.log("=== LineaDAT Phase 4 Mainnet Launch (Linea) ===");
        console.log("Deployer (hot):  ", deployer);
        console.log("Final owner:     ", ownerFinal);
        console.log("Creator fee addr:", creatorFeeAddr);
        console.log("Keeper:          ", keeper);
        console.log("Token name:      ", tokenName);
        console.log("Token symbol:    ", tokenSymbol);
        console.log("bagSize (wei):   ", bagSize);
        console.log("buyIncrement(wei):", buyIncrement);
        console.log("twapIncrement(wei):", twapIncrement);
        console.log("twapDelayBlocks: ", twapDelayBlocks);

        /* === Pre-compute deterministic addresses === */
        address futureImpl    = vm.computeCreateAddress(deployer, currentNonce + 1);
        address futureFactory = vm.computeCreateAddress(deployer, currentNonce + 2);
        address futureProxy   = vm.computeCreateAddress(futureFactory, 1);

        console.log("Future impl:     ", futureImpl);
        console.log("Future factory:  ", futureFactory);
        console.log("Future proxy:    ", futureProxy);

        /* === Mine hook salt against pre-computed proxy === */
        bytes memory hookInitCode = abi.encodePacked(
            type(LineaDATHook).creationCode,
            abi.encode(IPoolManager(POOL_MANAGER), futureProxy, ILineaDATFactory(futureFactory), creatorFeeAddr)
        );
        bytes32 codeHash = keccak256(hookInitCode);

        bytes32 salt = bytes32(0);
        address hookAddr;
        for (uint256 i = 0; i < MAX_SALT; i++) {
            bytes32 trySalt = bytes32(i);
            address predicted = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, trySalt, codeHash))))
            );
            if ((uint160(predicted) & 0x3FFF) == REQUIRED_FLAGS) {
                salt = trySalt;
                hookAddr = predicted;
                console.log("Hook salt mined: ", uint256(trySalt));
                console.log("Hook address:    ", hookAddr);
                break;
            }
        }
        require(hookAddr != address(0), "Hook mining failed; bump MAX_SALT");

        /* === Begin broadcast === */
        vm.startBroadcast();

        // 1. Deploy hook via CREATE2 first
        bytes memory deployData = abi.encodePacked(salt, hookInitCode);
        (bool ok, ) = CREATE2_DEPLOYER.call(deployData);
        require(ok, "CREATE2 deploy call failed");
        require(hookAddr.code.length > 0, "Hook deploy failed: no code at predicted addr");
        console.log("[1] Hook deployed via CREATE2 at:", hookAddr);

        // 2. Deploy strategy implementation
        LineaDATStrategy impl = new LineaDATStrategy();
        require(address(impl) == futureImpl, "Impl address mismatch");
        console.log("[2] LineaDATStrategy impl:        ", address(impl));

        // 3. Deploy factory (deployer = temp owner during atomic setup)
        LineaDATFactory factory = new LineaDATFactory(IPoolManager(POOL_MANAGER), UNIVERSAL_ROUTER);
        require(address(factory) == futureFactory, "Factory address mismatch");
        console.log("[3] LineaDATFactory:              ", address(factory));

        // 4. Configure factory
        factory.setStrategyImplementation(address(impl));
        factory.updateHookAddress(hookAddr);
        console.log("[4] Factory configured: impl + hook set");

        // 4b. Optional delayed-launch gate
        uint256 launchTs = vm.envOr("SCHEDULED_LAUNCH_TIME", uint256(0));
        if (launchTs != 0) {
            require(launchTs > block.timestamp, "SCHEDULED_LAUNCH_TIME must be future");
            LineaDATHook(payable(hookAddr)).setScheduledLaunchTime(launchTs);
            console.log("[4b] scheduledLaunchTime set to:  ", launchTs);
        } else {
            console.log("[4b] No SCHEDULED_LAUNCH_TIME -> trading opens immediately at pool init");
        }

        // 5. Deploy strategy proxy. Owner = deployer (temp); transferred to ownerFinal at the end.
        address proxyAddr = factory.deployStrategy(
            LINEA_TOKEN, bagSize, tokenName, tokenSymbol, deployer, buyIncrement
        );
        require(proxyAddr == futureProxy, "Proxy address mismatch - hook will be wrong");
        LineaDATStrategy strategy = LineaDATStrategy(payable(proxyAddr));
        console.log("[5] LineaDATStrategy proxy:       ", proxyAddr);

        // 6. Owner-side TWAP setup (deployer is temp owner)
        strategy.setTwapIncrement(twapIncrement);
        strategy.setTwapDelayInBlocks(twapDelayBlocks);
        console.log("[6] TWAP increment (wei):", twapIncrement);
        console.log("[6] TWAP delay (blocks): ", twapDelayBlocks);

        // 6b. Claim 10% creator share. Combined with constructor-set hook.feeAddress, gives 80/20 split.
        //     Required step per docs/50-lineadat-spec.md sec 3 to avoid ownerAmount silently merging into treasury.
        // INV:fee-address-claim-after-redeploy repeat after every proxy redeploy; see docs/INVARIANTS.md
        LineaDATHook(payable(hookAddr)).adminUpdateFeeAddress(proxyAddr, creatorFeeAddr);
        console.log("[6b] feeAddressClaimedByOwner[proxy] -> ", creatorFeeAddr);

        // 7. Deploy seeder
        LineaDATSeeder seeder = new LineaDATSeeder(IPoolManager(POOL_MANAGER));
        console.log("[7] LineaDATSeeder:               ", address(seeder));

        // 8. Move 1B LineaDAT from factory to seeder
        strategy.factoryEscape(address(seeder), TOTAL_SUPPLY);
        console.log("[8] factoryEscape -> seeder. seeder LineaDAT bal:", strategy.balanceOf(address(seeder)));

        // 9. Set loadingLiquidity flag so hook lets the seed pass
        factory.setLoadingLiquidity(true);

        // 10. Initialize pool + add single-sided LP
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(proxyAddr),
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(TICK_UPPER);
        uint160 sqrtPa = TickMath.getSqrtPriceAtTick(TICK_LOWER);
        uint160 sqrtPb = TickMath.getSqrtPriceAtTick(TICK_UPPER);
        uint256 liquidity = (TOTAL_SUPPLY * (1 << 96)) / (sqrtPb - sqrtPa);
        require(liquidity <= type(uint128).max, "liquidity overflow uint128");
        console.log("[10] Pool sqrtPriceX96:           ", sqrtPriceX96);
        console.log("     Liquidity L:                 ", liquidity);

        seeder.seedAndLock(key, sqrtPriceX96, TICK_LOWER, TICK_UPPER, int256(liquidity));
        console.log("[10] Pool initialized, liquidity locked permanently in seeder");

        // 11. Unset loadingLiquidity
        factory.setLoadingLiquidity(false);

        // 12. No on-chain bot contract. The keeper EOA is the arbitrageur: it calls the
        //     permissionless strategy entrypoints (buyTokens/sellTokens/processTokenTwap)
        //     directly, holding only ETH and acquiring $LINEA on the open market. It never
        //     moves TDAT wallet-to-wallet, so it needs no distributor whitelist (the transfer
        //     gate in BaseStrategy._afterTokenTransfer only constrains TDAT, not canonical
        //     $LINEA). This mirrors how community bots will interact with the protocol.

        // 13. HANDOVER: transfer strategy + factory ownership to Keycard EOA.
        //     After this, only Keycard can: updateHookAddress, setDistributor, setTwapIncrement,
        //     setTwapDelayInBlocks, _authorizeUpgrade, factory.deployStrategy, factory.updateHookAddress,
        //     hook.adminUpdateFeeAddress (via factory.owner check).
        strategy.transferOwnership(ownerFinal);
        factory.transferOwnership(ownerFinal);
        console.log("[13] Ownership transferred to:    ", ownerFinal);

        vm.stopBroadcast();

        /* === Final summary === */
        console.log("");
        console.log("================================================");
        console.log("=== LineaDAT Phase 4 MAINNET LAUNCH COMPLETE ===");
        console.log("================================================");
        console.log("ChainId:               59144 (Linea)");
        console.log("$LINEA underlying:    ", LINEA_TOKEN);
        console.log("LineaDATStrategy impl:", address(impl));
        console.log("LineaDATFactory:      ", address(factory));
        console.log("LineaDATHook:         ", hookAddr);
        console.log("LineaDAT proxy:       ", proxyAddr);
        console.log("LineaDATSeeder:       ", address(seeder));
        console.log("Owner (Keycard):      ", ownerFinal);
        console.log("Creator fee wallet:   ", creatorFeeAddr);
        console.log("Keeper:               ", keeper);
        console.log("================================================");
        console.log("");
        console.log("Effective fee split per swap:");
        console.log("  80% -> treasury proxy (currentFees, available for buyTokens)");
        console.log("  10% -> creator (LineaDAT-burn redirect on self-launch)");
        console.log("  10% -> creator (feeAddressClaimedByOwner[proxy])");
        console.log("  = 2% of swap volume -> creator wallet");
    }
}
