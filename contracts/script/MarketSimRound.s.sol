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

/// @notice Phase 3.5 — Market simulator. One swap per script invocation; cron paces the cadence.
///
/// CHOICE LOGIC (deterministic from block + run_id env):
///   - 70% buy (ETH -> LineaDAT), 30% sell (LineaDAT -> ETH)
///   - buy size: 0.0008-0.0015 ETH (random within range)
///   - sell size: 200-800 LineaDAT (random within range, capped to caller's balance)
///
/// USAGE:
///   ROUND_ID=42 forge script script/MarketSimRound.s.sol:MarketSimRound \
///     --rpc-url https://base-sepolia-rpc.publicnode.com \
///     --broadcast --private-key $PRIVATE_KEY -vvv
contract MarketSimRound is Script {
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINEADAT_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;
    address constant SWAPPER = 0x1a1434d72B23B1A968824191195efcf95B07116c;
    address constant HOOK = 0x61116044DC8eB623A618021cEDB14836D6512444;
    int24 constant TICK_SPACING = 60;
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia");
        address caller = msg.sender;

        uint256 roundId = vm.envOr("ROUND_ID", uint256(block.number));
        uint256 entropy = uint256(keccak256(abi.encode(roundId, block.number, blockhash(block.number - 1))));
        uint256 chooser = entropy % 100; // 0-99

        LineaDATStrategy proxy = LineaDATStrategy(payable(LINEADAT_PROXY));
        LineaDATTestSwapper swapper = LineaDATTestSwapper(payable(SWAPPER));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(LINEADAT_PROXY),
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        uint256 callerBal = proxy.balanceOf(caller);
        uint256 callerEth = caller.balance;
        console.log("=== MarketSim round", roundId, "===");
        console.log("Caller:", caller);
        console.log("Caller ETH (wei):", callerEth);
        console.log("Caller LineaDAT (wei):", callerBal);
        console.log("currentFees pre (wei):", proxy.currentFees());

        // Decide: 70% buy, 30% sell. Force buy if caller has < 200 LineaDAT (can't sell meaningfully).
        bool doBuy = chooser < 70 || callerBal < 200 ether;

        vm.startBroadcast();

        if (doBuy) {
            // Buy size: 0.0008-0.0015 ETH range (random within)
            uint256 buyMin = 0.0008 ether;
            uint256 buyMax = 0.0015 ether;
            uint256 amount = buyMin + (entropy % (buyMax - buyMin + 1));
            require(callerEth > amount + 0.0001 ether, "Caller out of ETH");
            console.log("ACTION: BUY (ETH wei):", amount);
            swapper.buyExactInput{value: amount}(key, caller);
        } else {
            // Sell size: 200-800 LineaDAT (in 18-decimal units), capped to balance / 10
            uint256 sellMin = 200 ether;
            uint256 sellMax = 800 ether;
            uint256 amount = sellMin + (entropy % (sellMax - sellMin + 1));
            uint256 cap = callerBal / 10;
            if (amount > cap) amount = cap;
            console.log("ACTION: SELL (LineaDAT wei):", amount);
            // Approve swapper to pull LineaDAT (one-shot allowance for this round)
            (bool ok,) = LINEADAT_PROXY.call(abi.encodeWithSignature("approve(address,uint256)", SWAPPER, amount));
            require(ok, "approve failed");
            swapper.sellExactInput(key, amount, caller);
        }

        vm.stopBroadcast();

        console.log("currentFees post (wei):", proxy.currentFees());
        console.log("Caller LineaDAT post (wei):", proxy.balanceOf(caller));
    }
}
