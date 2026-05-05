// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {LineaDATHook} from "../src/LineaDATHook.sol";
import {ILineaDATFactory} from "../src/Interfaces.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice LineaDAT full deployment script.
///
/// PRE-FLIGHT (must be done off-chain before running this script):
///   1. Run `MineHook.s.sol` to find a valid hook salt + predicted address
///   2. Set HOOK_SALT below or pass via env var
///   3. Fund the deployer EOA with ~0.05 ETH on Linea for gas
///
/// SEQUENCE:
///   1. Deploy LineaDATStrategy implementation
///   2. Deploy LineaDATFactory (immutable args: poolManager, universalRouter)
///   3. factory.setStrategyImplementation(impl)
///   4. Deploy LineaDATHook via CREATE2 with mined salt — passes lineaDATAddress=address(0) initially.
///      Note: We will use a CREATE2 deployer factory; hook constructor needs lineaDATAddress.
///      Solution: deploy hook AFTER strategy proxy by computing strategy proxy address via
///      LibClone.predictDeterministicAddress. For Phase 1 we use a 2-step approach (see comments below).
///   5. factory.updateHookAddress(hookAddr)
///   6. factory.deployStrategy(LINEA, BAG_SIZE, "LineaDAT", "LINEADAT", OWNER, BUY_INCREMENT)
///   7. Post-init: hook.adminUpdateFeeAddress(strategy, FEE_ADDRESS)
///   8. proxy.setTwapIncrement(0.05 ether) (via OWNER)
///   9. proxy.setTwapDelayInBlocks(4) (via OWNER)
///  10. Initialize Uniswap v4 pool with calibrated sqrtPriceX96 (out of scope of script v1 — done manually
///      via cast or PositionManager front-end).
///
/// Run on Anvil fork:
///   anvil --fork-url https://rpc.linea.build &
///   forge script script/Deploy.s.sol:Deploy --rpc-url http://localhost:8545 --broadcast \
///     --private-key $DEPLOYER_PK
contract Deploy is Script {
    // === Locked LineaDAT params ===
    address constant LINEA = 0x1789e0043623282D5DCc7F213d703C6D8BAfBB04;
    uint256 constant BAG_SIZE = 150_000 * 1e18;
    uint256 constant BUY_INCREMENT = 0.02 ether;
    uint256 constant TWAP_INCREMENT = 0.05 ether;
    uint256 constant TWAP_DELAY_BLOCKS = 4;
    address constant OWNER = 0x1470c542D60e83EcCFE005332f5789Bd669D027C;
    address constant FEE_ADDRESS = 0x6e0d01089976093680c881CcDcB79e0D046e2433;

    // === Linea Uniswap v4 deployments (verified in docs/40-linea-infrastructure.md) ===
    address constant POOL_MANAGER_LINEA = 0x248083Fb965359d82b06C1F5322480Dcfc1AD857;
    address constant UNIVERSAL_ROUTER_V2_1_1 = 0x8B844f885672f333Bc0042cB669255f93a4C1E6b;
    address constant POSITION_MANAGER_LINEA = 0xdDCAD5775B2816a87495f207731b3571D7EE3c76;

    // === To be filled in after MineHook ===
    bytes32 constant HOOK_SALT = bytes32(0); // CHANGE-ME after running MineHook

    function run() external {
        vm.startBroadcast();

        // Step 1: Deploy implementation
        LineaDATStrategy impl = new LineaDATStrategy();
        console.log("LineaDATStrategy implementation:", address(impl));

        // Step 2: Deploy factory
        LineaDATFactory factory = new LineaDATFactory(IPoolManager(POOL_MANAGER_LINEA), UNIVERSAL_ROUTER_V2_1_1);
        console.log("LineaDATFactory:", address(factory));

        // Step 3: Set implementation
        factory.setStrategyImplementation(address(impl));

        // Step 4: Deploy hook (CREATE2 with mined salt). For Phase 1 dry-run we deploy with lineaDATAddress=0;
        // for production deploy you must FIRST predict the strategy proxy address (deterministic via factory clone)
        // and pass that into the hook constructor BEFORE deploying the proxy.
        //
        // Phase 1 simplified: deploy hook with lineaDATAddress=0, then patch via separate flow. NOT for production.
        // Phase 2/3/4: full sequence with deterministic prediction (see docs/60-deployment-runbook.md).
        if (HOOK_SALT != bytes32(0)) {
            // Production path: salt was pre-mined
            // Hook deploy via CREATE2 — needs deterministic deployer. Skipping in this MVP script.
            console.log("[!] HOOK_SALT set: production CREATE2 deploy not implemented in MVP script.");
            console.log("[!] For Phase 4 mainnet, use the dedicated deployer (DeployImplementations.s.sol).");
            revert("Production CREATE2 hook deploy not in MVP");
        }

        // Step 5+: deferred until hook is in place via CREATE2.
        // Demonstrate setup via traditional `new` (NOT mainnet-safe, only for local Anvil dry-run):
        // Note: this would normally fail because hook address doesn't satisfy permission flags.
        // Skipping — this script is documentation as code for now.

        console.log("Deploy script: implementation + factory deployed; hook deploy pending CREATE2 mining.");

        vm.stopBroadcast();
    }
}
