// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";

/// @notice Phase 3 testnet helper — feed currentFees on the strategy from the deployer EOA (acting as hook).
///
/// Useful for keeping bot rounds productive during testnet observation. Run periodically (every few hours)
/// to simulate organic swap-fee distribution.
///
/// Usage:
///   STRATEGY=<proxy_addr> SEED_AMOUNT=0.05ether \
///     forge script script/SeedFees.s.sol:SeedFees \
///     --rpc-url $BASE_SEPOLIA_RPC \
///     --broadcast --private-key $PRIVATE_KEY
contract SeedFees is Script {
    function run() external {
        address strategyAddr = vm.envAddress("STRATEGY");
        uint256 amount = vm.envOr("SEED_AMOUNT", uint256(0.05 ether));

        LineaDATStrategy strategy = LineaDATStrategy(payable(strategyAddr));

        console.log("Strategy:        ", strategyAddr);
        console.log("Seeding amount:  ", amount, "wei");
        console.log("Deployer balance:", vm.addr(vm.envUint("PRIVATE_KEY")).balance, "wei");

        vm.startBroadcast();
        strategy.addFees{value: amount}();
        vm.stopBroadcast();

        console.log("currentFees after:", strategy.currentFees());
        console.log("Done.");
    }
}
