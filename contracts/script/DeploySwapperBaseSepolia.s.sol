// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineastrTestSwapper} from "../src/LineastrTestSwapper.sol";
import {LINEASTRStrategy} from "../src/LINEASTRStrategy.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Phase 3.5 — deploy LineastrTestSwapper v2 (Buy + Sell) and whitelist as distributor.
contract DeploySwapperBaseSepolia is Script {
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINEASTR_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia");

        vm.startBroadcast();
        LineastrTestSwapper swapper = new LineastrTestSwapper(IPoolManager(POOL_MANAGER));
        LINEASTRStrategy proxy = LINEASTRStrategy(payable(LINEASTR_PROXY));
        proxy.setDistributor(address(swapper), true);
        vm.stopBroadcast();

        console.log("LineastrTestSwapper v2 (Buy+Sell):", address(swapper));
        console.log("Marked as distributor:            true");
    }
}
