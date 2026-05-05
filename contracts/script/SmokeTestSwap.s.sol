// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATTestSwapper} from "../src/LineaDATTestSwapper.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

/// @notice Phase 3.5 — One-shot test swap to verify pool + hook are live.
contract SmokeTestSwap is Script {
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINEADAT_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;
    address constant HOOK = 0x61116044DC8eB623A618021cEDB14836D6512444;
    int24 constant TICK_SPACING = 60;
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia");
        address deployer = msg.sender;

        LineaDATStrategy proxy = LineaDATStrategy(payable(LINEADAT_PROXY));
        uint256 preFees = proxy.currentFees();
        uint256 preDeployerBal = proxy.balanceOf(deployer);

        console.log("=== Pre-swap ===");
        console.log("Strategy.currentFees:", preFees);
        console.log("Deployer LineaDAT balance:", preDeployerBal);
        console.log("");

        vm.startBroadcast();

        LineaDATTestSwapper swapper = new LineaDATTestSwapper(IPoolManager(POOL_MANAGER));
        console.log("[1] LineaDATTestSwapper:", address(swapper));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(LINEADAT_PROXY),
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        // Mark deployer as distributor so the inbound transfer (poolManager -> deployer)
        // passes _afterTokenTransfer's whitelist check.
        proxy.setDistributor(deployer, true);
        console.log("[2] setDistributor(deployer, true)");

        // Mark swapper as distributor too — outbound transfer (swapper -> poolManager) for the ETH leg
        // is just NATIVE so no token transfer; but the receive of LineaDAT by swapper before forwarding to deployer
        // could trip the check. take() goes directly to recipient, so we should be ok, but mark anyway as belt-and-suspenders.
        proxy.setDistributor(address(swapper), true);
        console.log("[3] setDistributor(swapper, true)");

        // Execute swap: 0.001 ETH -> LineaDAT, recipient = deployer
        swapper.buyExactInput{value: 0.001 ether}(key, deployer);
        console.log("[4] Swap executed");

        vm.stopBroadcast();

        uint256 postFees = proxy.currentFees();
        uint256 postDeployerBal = proxy.balanceOf(deployer);

        console.log("");
        console.log("=== Post-swap ===");
        console.log("Strategy.currentFees:", postFees);
        console.log("Delta currentFees (wei):", postFees - preFees);
        console.log("Deployer LineaDAT balance:", postDeployerBal);
        console.log("Delta deployer LineaDAT (wei):", postDeployerBal - preDeployerBal);
    }
}
