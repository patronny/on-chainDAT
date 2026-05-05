// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {LineaDATBot} from "../src/LineaDATBot.sol";
import {MockTLINEA} from "../src/MockTLINEA.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Phase 3 testnet deploy script for Base Sepolia (chainId 84532).
///
/// SCOPE NOTE: This deploy uses the deployer EOA as the strategy's hookAddress (instead of mining a real
/// LineaDATHook via CREATE2). Rationale:
///   1. Phase 3 main goal is bot validation under live network conditions, NOT full Uniswap v4 pool integration
///   2. Without a real hook, we can't initialize a Uniswap v4 pool (hook permission flags wouldn't validate)
///   3. P2P buyTokens / sellTokens don't depend on Uniswap pool — they only depend on currentFees and onSale state
///   4. We seed currentFees by having the deployer EOA call strategy.addFees{value: X}() (deployer is hookAddress)
///   5. processTokenTwap will fail (no real pool) but bot's _tryTwap has try/catch — it logs and moves on
///
/// Phase 4 (Linea mainnet) will use the full CREATE2-mined hook + pool init pipeline (see Deploy.s.sol).
///
/// SEQUENCE:
///   1. Deploy MockTLINEA (testnet stub for $LINEA, with public faucet)
///   2. Deploy LineaDATStrategy implementation
///   3. Deploy LineaDATFactory
///   4. factory.setStrategyImplementation(impl)
///   5. factory.updateHookAddress(DEPLOYER_EOA)  [acts as fake hook for testnet]
///   6. factory.deployStrategy(tLINEA, BAG_SIZE, ...) → strategy proxy
///   7. proxy.setTwapIncrement(0.05 ether)
///   8. proxy.setTwapDelayInBlocks(4)
///   9. Deploy LineaDATBot(proxy, tLINEA, KEEPER, OWNER)
///  10. tLINEA.mint(bot, 1_500_000 * 1e18)  [10 bag-quantities]
///  11. proxy.setDistributor(bot, true)
///  12. Seed initial fees: deployer calls proxy.addFees{value: 0.5 ether}()
///
/// ENV VARS:
///   PRIVATE_KEY              — deployer EOA private key (also acts as hook, must hold ETH on Base Sepolia)
///   OWNER_EOA                — owner of strategy + bot + tLINEA (typically deployer for testnet)
///   KEEPER_EOA               — keeper EOA that will run bot.executeRound() (can be same as deployer)
///   FEE_ADDRESS              — recipient of protocol fees (typically owner)
///
/// USAGE:
///   forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
///     --rpc-url https://base-sepolia.drpc.org \
///     --broadcast --private-key $PRIVATE_KEY -vvvv
///
/// OUTPUT: deployments/base-sepolia.json with all addresses.
contract DeployBaseSepolia is Script {
    // === Locked LineaDAT params (per docs/50-lineadat-spec.md) ===
    uint256 constant BAG_SIZE = 150_000 * 1e18;
    uint256 constant BUY_INCREMENT = 0.02 ether;
    uint256 constant TWAP_INCREMENT = 0.05 ether;
    uint256 constant TWAP_DELAY_BLOCKS = 4;
    uint256 constant BOT_INITIAL_LINEA = 1_500_000 * 1e18; // 10 bag-quantities
    uint256 constant SEED_FEES_AMOUNT = 0.05 ether; // initial currentFees seed (gives bot one immediate buy)

    // === Base Sepolia v4 deployments (verified live via cast) ===
    address constant POOL_MANAGER_BASE_SEPOLIA = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant UNIVERSAL_ROUTER_BASE_SEPOLIA = 0x492E6456D9528771018DeB9E87ef7750EF184104;

    function run() external {
        // Resolve actor addresses from env (with deployer-as-default fallback for owner/keeper/fee)
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        address ownerEoa = vm.envOr("OWNER_EOA", deployer);
        address keeperEoa = vm.envOr("KEEPER_EOA", deployer);
        address feeAddr = vm.envOr("FEE_ADDRESS", ownerEoa);

        console.log("=== LineaDAT Base Sepolia Deployment ===");
        console.log("Chain ID:        ", block.chainid);
        console.log("Deployer (=hook):", deployer);
        console.log("Owner:           ", ownerEoa);
        console.log("Keeper:          ", keeperEoa);
        console.log("Fee address:     ", feeAddr);
        console.log("");

        require(block.chainid == 84532, "Must be on Base Sepolia (chainId 84532)");

        vm.startBroadcast();

        // Step 1: Deploy MockTLINEA (testnet stub for $LINEA)
        MockTLINEA tLinea = new MockTLINEA(ownerEoa);
        console.log("[1] MockTLINEA deployed at:", address(tLinea));

        // Step 2: Deploy LineaDATStrategy implementation
        LineaDATStrategy impl = new LineaDATStrategy();
        console.log("[2] LineaDATStrategy impl: ", address(impl));

        // Step 3: Deploy LineaDATFactory
        LineaDATFactory factory = new LineaDATFactory(
            IPoolManager(POOL_MANAGER_BASE_SEPOLIA),
            UNIVERSAL_ROUTER_BASE_SEPOLIA
        );
        console.log("[3] LineaDATFactory:       ", address(factory));

        // Step 4: Configure factory implementation
        factory.setStrategyImplementation(address(impl));
        console.log("[4] Factory.setStrategyImplementation: ok");

        // Step 5: Set hook to deployer EOA (Phase 3 testnet shortcut — deployer can call addFees)
        // Use the *Unchecked variant because deployer is an EOA (no code), the production
        // updateHookAddress requires a real CREATE2-mined hook contract.
        factory.updateHookAddressUnchecked(deployer);
        console.log("[5] Factory.updateHookAddressUnchecked -> deployer EOA");

        // Step 6: Deploy LineaDAT strategy proxy (the self-launch token)
        address proxyAddr = factory.deployStrategy(
            address(tLinea), BAG_SIZE, "LineaDAT", "LINEADAT", ownerEoa, BUY_INCREMENT
        );
        LineaDATStrategy proxy = LineaDATStrategy(payable(proxyAddr));
        console.log("[6] LineaDATStrategy proxy:", proxyAddr);

        // Step 7-8: Owner-side TWAP setup. NOTE: deployer == owner only if OWNER_EOA defaulted; otherwise
        // the owner needs to run setTwapIncrement / setTwapDelayInBlocks separately. We attempt it here
        // and skip silently if deployer is not owner (broadcast will fail otherwise).
        if (deployer == ownerEoa) {
            proxy.setTwapIncrement(TWAP_INCREMENT);
            proxy.setTwapDelayInBlocks(TWAP_DELAY_BLOCKS);
            console.log("[7-8] Strategy TWAP params set (twapIncrement=0.05 ETH, twapDelayInBlocks=4)");
        } else {
            console.log("[7-8] SKIP: deployer != owner. Run setTwapIncrement + setTwapDelayInBlocks from OWNER_EOA");
        }

        // Step 9: Deploy LineaDATBot
        LineaDATBot bot = new LineaDATBot(proxyAddr, address(tLinea), keeperEoa, ownerEoa);
        console.log("[9] LineaDATBot:           ", address(bot));

        // Step 10: Seed bot with tLINEA (owner-only on tLINEA)
        if (deployer == ownerEoa) {
            tLinea.mint(address(bot), BOT_INITIAL_LINEA);
            console.log("[10] Bot funded with 1.5M tLINEA");
        } else {
            console.log("[10] SKIP: deployer != owner. Run tLinea.mint(bot, 1.5M*1e18) from OWNER_EOA");
        }

        // Step 11: Whitelist bot as distributor on strategy (so bot's tLINEA inflows from sellTokens
        //         don't get blocked by strategy's _afterTokenTransfer transient allowance check)
        if (deployer == ownerEoa) {
            proxy.setDistributor(address(bot), true);
            console.log("[11] Strategy.setDistributor(bot, true)");
        } else {
            console.log("[11] SKIP: run proxy.setDistributor(bot, true) from OWNER_EOA");
        }

        // Step 12: Seed initial currentFees so bot has work in its first round
        // (deployer is hookAddress, so deployer.call(strategy.addFees{value: X}()) succeeds)
        proxy.addFees{value: SEED_FEES_AMOUNT}();
        console.log("[12] Strategy seeded with 0.05 ETH initial currentFees");

        vm.stopBroadcast();

        // Final summary block
        console.log("");
        console.log("================================================");
        console.log("=== DEPLOYMENT COMPLETE - SAVE THESE ADDRS   ===");
        console.log("================================================");
        console.log("ChainId:               84532 (Base Sepolia)");
        console.log("MockTLINEA:           ", address(tLinea));
        console.log("LineaDATStrategy impl:", address(impl));
        console.log("LineaDATFactory:      ", address(factory));
        console.log("LineaDAT proxy:       ", proxyAddr);
        console.log("LineaDATBot:          ", address(bot));
        console.log("Deployer (hook):      ", deployer);
        console.log("Owner:                ", ownerEoa);
        console.log("Keeper:               ", keeperEoa);
        console.log("================================================");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Send 5+ ETH to bot address for sellTokens fuel");
        console.log("  2. Set up cron at cron-job.org / GitHub Actions to call bot.executeRound() every 5-10 min");
        console.log("  3. Periodically seed more fees: proxy.addFees{value:X}() from deployer EOA");
        console.log("  4. Update frontend .env.local with these addresses");
    }
}
