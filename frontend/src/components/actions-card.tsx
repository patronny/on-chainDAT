"use client";

import { useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "./ui/button";
import { strategyAbi } from "@/lib/abis/strategy";
import { erc20Abi } from "@/lib/abis/erc20";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ADDR, DEFAULT_CHAIN_ID } from "@/lib/wagmi";
import { formatEth } from "@/lib/utils";

/**
 * Actions card - quick-access secondary actions: Approve tLINEA (for bot bag flow),
 * Trigger TWAP (anyone earns 0.5% reward), Faucet (claim 300k tLINEA per hour
 * via the dedicated LineaDATFaucet wrapper; legacy MockTLINEA.faucetClaim 100k
 * still works on-chain but the UI no longer surfaces it).
 */
// Linea mainnet has no faucet / testnet ETH tap - gates the faucet UI AND its
// polling reads (a lastFaucetAt eth_call against a non-existent contract was
// firing every 30s per connected wallet on mainnet).
const isMainnet = DEFAULT_CHAIN_ID === 59144;

const faucetAbi = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "lastFaucetAt",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
export function ActionsCard() {
  const { data: stats, refetch: refetchStats } = useStrategyStats();
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  // Block height for the cosmetic TWAP-cooldown counter, from the shared snapshot
  // (was a per-browser eth_blockNumber poll). ~15s granularity is fine here.
  const blockNumber = stats?.blockNumber;

  const { data: tlineaBal, refetch: refetchTBal } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: tlineaAllowance, refetch: refetchTAllow } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.strategy] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: lastFaucet, refetch: refetchLastFaucet } = useReadContract({
    address: ADDR.faucet,
    abi: faucetAbi,
    functionName: "lastFaucetAt",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !isMainnet, refetchInterval: 30_000 },
  });

  // Re-pull every reactive read the moment a write confirms - otherwise stale
  // state lingers ~12s (next polling tick) and users rage-click the button
  // straight into TwapDelayNotMet / faucet cooldown reverts.
  useEffect(() => {
    if (!isConfirmed) return;
    refetchStats();
    refetchTBal();
    refetchTAllow();
    refetchLastFaucet();
  }, [isConfirmed, refetchStats, refetchTBal, refetchTAllow, refetchLastFaucet]);

  const ethToTwap = stats?.ethToTwap ?? 0n;
  const twapReady = ethToTwap > 0n;
  const lastTwapBlock = stats?.lastTwapBlock ?? 0n;
  const twapDelayInBlocks = stats?.twapDelayInBlocks ?? 0n;
  // processTokenTwap reverts with TwapDelayNotMet() while
  //   block.number < lastTwapBlock + twapDelayInBlocks
  // (BaseStrategy / LineaDATStrategy). Mirror that on the button so the user
  // physically cannot fire the second burn into the 4-block cooldown window.
  const nextTwapBlock = lastTwapBlock + twapDelayInBlocks;
  const blocksUntilTwap =
    blockNumber !== undefined && nextTwapBlock > blockNumber
      ? Number(nextTwapBlock - blockNumber)
      : 0;
  const twapCooldown = blocksUntilTwap > 0;

  const bagSize = stats?.bagSize ?? 0n;
  const availableFunds = stats?.availableFunds ?? 0n;
  const enoughT = (tlineaBal ?? 0n) >= bagSize;
  const approved = (tlineaAllowance ?? 0n) >= bagSize;
  const canSellBag = approved && enoughT && availableFunds > 0n;

  const cooldown = 3600;
  const last = Number(lastFaucet ?? 0n);
  const now = Math.floor(Date.now() / 1000);
  const faucetReady = last === 0 || now - last >= cooldown;

  // INV:tx-busy-guard tx buttons disabled until receipt; see docs/INVARIANTS.md
  const txBusy = isPending || isConfirming;

  // Stage-aware copy: Linea mainnet uses canonical $LINEA.
  const ut = isMainnet ? "$LINEA" : "$tLINEA";

  function approveTlinea() {
    writeContract({ address: ADDR.tLINEA, abi: erc20Abi, functionName: "approve", args: [ADDR.strategy, bagSize] });
  }
  function sellBag() {
    writeContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "buyTokens" });
  }
  function triggerTwap() {
    writeContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "processTokenTwap" });
  }
  function claimFaucet() {
    writeContract({ address: ADDR.faucet, abi: faucetAbi, functionName: "claim" });
  }

  return (
    <div className="p-4 sm:p-5 space-y-2">
        {!approved ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={approveTlinea}
            disabled={!isConnected || txBusy || !enoughT}
          >
            {!enoughT
              ? isMainnet ? "Get $LINEA first" : "Get tLINEA from faucet first"
              : txBusy ? "Approving..." : `Approve ${ut}`}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={sellBag}
            disabled={!isConnected || txBusy || !canSellBag}
          >
            {availableFunds === 0n
              ? isMainnet ? "No fees yet - awaiting keeper round" : "No fees yet - wait for next bot round"
              : !enoughT
                ? isMainnet ? `Need ${ut} to sell a bag` : "Need 150k tLINEA to sell a bag"
                : txBusy
                  ? "Selling bag..."
                  : isMainnet
                    ? `Sell ${ut} bag → ${formatEth(availableFunds)} ETH`
                    : `Sell 150k tLINEA bag → ${formatEth(availableFunds)} ETH`}
          </Button>
        )}

        <Button
          variant="secondary"
          className="w-full"
          onClick={triggerTwap}
          disabled={!isConnected || txBusy || !twapReady || twapCooldown}
        >
          {!twapReady
            ? "No ETH to TWAP yet"
            : txBusy
              ? "Burning..."
              : twapCooldown
                ? `TWAP cooldown: ${blocksUntilTwap} block${blocksUntilTwap === 1 ? "" : "s"}`
                : `Trigger TWAP · ${formatEth(ethToTwap)} ETH`}
        </Button>

        {/* Faucet + testnet-ETH tap exist only on the Base Sepolia testnet. On Linea
            mainnet users bridge real ETH and acquire canonical $LINEA on a DEX. */}
        {!isMainnet && (
          <>
            <Button
              variant="secondary"
              className="w-full"
              onClick={claimFaucet}
              disabled={!isConnected || txBusy || !faucetReady}
            >
              {!faucetReady
                ? `Faucet cooldown: ${Math.ceil((cooldown - (now - last)) / 60)} min`
                : txBusy
                  ? "Claiming..."
                  : "Faucet - claim 300k tLINEA"}
            </Button>

            <Button asChild variant="secondary" className="w-full">
              <a
                href="https://portal.cdp.coinbase.com/products/faucet"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Base Sepolia ETH ↗
              </a>
            </Button>
          </>
        )}
    </div>
  );
}
