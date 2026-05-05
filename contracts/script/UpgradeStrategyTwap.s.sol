// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";

/// @notice Phase 3.5 — deploy LineaDATStrategy V3 impl (with TWAP override + unlockCallback)
///         and UUPS-upgrade the proxy.
contract UpgradeStrategyTwap is Script {
    address constant LINEADAT_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia");

        vm.startBroadcast();
        LineaDATStrategy newImpl = new LineaDATStrategy();
        LineaDATStrategy proxy = LineaDATStrategy(payable(LINEADAT_PROXY));
        proxy.upgradeToAndCall(address(newImpl), "");
        vm.stopBroadcast();

        console.log("New LineaDATStrategy V3 impl:", address(newImpl));
        console.log("Proxy upgraded.");
    }
}
