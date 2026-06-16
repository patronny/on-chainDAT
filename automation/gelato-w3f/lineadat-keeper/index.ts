/**
 * LDAT Keeper - Gelato Web3 Function (W3F)
 *
 * Replaces the GitHub Actions keeper.yml cron with Gelato's reliable
 * decentralized keeper network. Gelato runs this function on schedule (we'll
 * configure 30 min) and submits the resulting tx via their executor pool.
 *
 * Free tier: 200,000 monthly executions (way more than we need).
 * Setup: see ./README.md for the deploy + create-task flow on app.gelato.network.
 *
 * IMPORTANT: This file uses @gelatonetwork/web3-functions-sdk runtime, not
 * standard Node. It runs in a sandboxed Deno environment with built-in
 * `userArgs`, `secrets`, `multiChainProvider`, and `storage`.
 */

import { Web3Function, Web3FunctionContext } from "@gelatonetwork/web3-functions-sdk";
import { Contract, Interface } from "ethers";

const STRATEGY_ABI = [
  "function currentFees() view returns (uint256)",
  "function availableFunds() view returns (uint256)",
  "function ethToTwap() view returns (uint256)",
  "function lastBagId() view returns (uint256)",
];

const BOT_ABI_FRAGMENT = "function executeRound(uint256 roundId)";

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { multiChainProvider, userArgs, storage } = context;

  // Read userArgs (set on the Gelato dashboard when creating the task).
  // Fallbacks point at the canonical Phase 3.5 LDAT atomic-launch deployment on Base Sepolia.
  const strategyAddr = (userArgs.strategy as string) ||
    "0x615937AE1eB71248DA407F39AcFea9288CF1784F";
  const botAddr = (userArgs.bot as string) ||
    "0x8FC3c32fd69D714413C1ecD66FA4067b08eE3532";
  const buyThresholdWeiStr = (userArgs.buyThresholdWei as string) ||
    "1000000000000000"; // 0.001 ETH
  const buyThreshold = BigInt(buyThresholdWeiStr);

  // Provider - multiChainProvider.default() returns the chain configured for
  // the Gelato task (Base Sepolia chainId 84532 in our case).
  const provider = multiChainProvider.default();
  const strategy = new Contract(strategyAddr, STRATEGY_ABI, provider);

  // Read state
  const [currentFees, availableFunds, ethToTwap, lastBagId] = await Promise.all([
    strategy.currentFees(),
    strategy.availableFunds(),
    strategy.ethToTwap(),
    strategy.lastBagId(),
  ]);

  // Pull last-seen counters from Gelato persistent storage
  const lastBagSeenStr = (await storage.get("lastBagSeen")) ?? "0";
  const lastEthToTwapSeenStr = (await storage.get("lastEthToTwapSeen")) ?? "0";
  const lastBagSeen = BigInt(lastBagSeenStr);
  const lastEthToTwapSeen = BigInt(lastEthToTwapSeenStr);

  // Decision logic - exec if any condition holds:
  //   1. fees ready for a bag buy
  //   2. unsold bag waiting that bot can flip
  //   3. ethToTwap > 0 (TWAP burn pending)
  const shouldRun =
    availableFunds >= buyThreshold ||
    BigInt(lastBagId) > lastBagSeen ||
    ethToTwap > 0n && ethToTwap !== lastEthToTwapSeen;

  if (!shouldRun) {
    return {
      canExec: false,
      message: `No-op: fees=${currentFees}, ethToTwap=${ethToTwap}, lastBagId=${lastBagId}`,
    };
  }

  // Persist seen counters so we don't double-trigger on the same state
  await storage.set("lastBagSeen", lastBagId.toString());
  await storage.set("lastEthToTwapSeen", ethToTwap.toString());

  const roundId = BigInt(Date.now());
  const iface = new Interface([BOT_ABI_FRAGMENT]);
  const calldata = iface.encodeFunctionData("executeRound", [roundId]);

  return {
    canExec: true,
    callData: [{ to: botAddr, data: calldata }],
  };
});
