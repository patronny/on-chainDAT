// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATBot} from "../src/LineaDATBot.sol";

/// @notice Phase 3 testnet helper — manually trigger bot.executeRound() from the keeper EOA.
///
/// In production this would be called by an automated cron service (cron-job.org, GitHub Actions,
/// Chainlink Automation, etc). This script is for manual testing or one-off runs.
///
/// Usage:
///   BOT=<bot_addr> ROUND_ID=42 \
///     forge script script/RunBotRound.s.sol:RunBotRound \
///     --rpc-url $BASE_SEPOLIA_RPC \
///     --broadcast --private-key $KEEPER_PK
contract RunBotRound is Script {
    function run() external {
        address botAddr = vm.envAddress("BOT");
        uint256 roundId = vm.envOr("ROUND_ID", uint256(block.timestamp));

        LineaDATBot bot = LineaDATBot(payable(botAddr));

        console.log("Bot:     ", botAddr);
        console.log("RoundId: ", roundId);
        console.log("Strategy:", address(bot.strategy()));
        console.log("Keeper:  ", bot.keeper());

        vm.startBroadcast();
        bot.executeRound(roundId);
        vm.stopBroadcast();

        console.log("Round executed.");
    }
}
