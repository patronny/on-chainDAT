# Swap execution

Purpose: turn a browser buy or sell of $LDAT into a Uniswap v4 swap - the
in-app trading path that feeds every fee, bag and burn downstream. Read
`docs/ARCHITECTURE.md` first for the four planes and the capital loop - this
doc covers the trade plane's client side: the standard Universal Router path
(option C, no custom swapper), the encoding in `frontend/src/lib/v4-swap.ts`,
the swap card's UX guards, the Quoter slippage floor, and fee surfacing.

## How it works

1. **Option C: the standard Uniswap Universal Router, not a custom
   swapper.** Trades are `execute([V4_SWAP], ...)` on the canonical UR
   (fallback 0x8B844f885672f333Bc0042cB669255f93a4C1E6b in
   `frontend/src/lib/wagmi.ts`, env-overridable [inv: vercel-env-overrides]).
   WHY: the original swap card called LineaDATTestSwapper, a "NOT for
   production" testnet helper deployed to mainnet and whitelisted as a
   distributor; the 2026-06-04 audit (obsidian/AUDIT-2026-06-04.md finding
   1.3, gitignored) flagged the trust surface and the same-day option C
   decision replaced it with the standard router. The swapper's distributor
   flag was later revoked (isDistributor(0xe784C8..) reads false on-chain
   today), so [inv: distributor-whitelist-after-swapper-redeploy] is moot
   for live LDAT.
2. **Why a plain router can move a non-transferable token.** Transfers
   revert outside the distributor whitelist
   [inv: transfers-distributor-gated], but the hook grants a transient
   transfer allowance in afterSwap covering PoolManager<->user moves, so
   pool trades need no whitelist entry - the property that made option C
   possible with zero custom code.
3. **Exact-input encoding, fork-proven.** encodeV4Swap in
   `frontend/src/lib/v4-swap.ts` packs one V4_SWAP command (actions
   SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL) over POOL_KEY from
   `frontend/src/lib/wagmi.ts` (currency0 = native ETH, currency1 =
   strategy proxy, dynamic fee flag, tickSpacing 60, the LDAT hook). Buy =
   one `execute{value}`, no approval. Sell = Permit2 first: one-time token
   approve to Permit2 plus Permit2 approve to the router at max
   amount/expiry, so later sells are one tx; `frontend/src/components/swap-card.tsx`
   rebuilds the approval queue per trade from live allowance reads,
   expiration included. The exact bytes were validated against the real
   router on a Linea-mainnet fork in `contracts/test/ForkQuoterSlippage.t.sol`.
4. **The slippage floor comes from the v4 Quoter, not the display
   estimate.** quoteExactInputSingle (declared `view` so viem eth_calls it;
   on-chain it unlocks the PoolManager and bubbles the result via revert)
   runs the real swap path including the hook's dynamic fee.
   amountOutMinimum = quote minus SLIPPAGE_BPS (200 = 2%), buffering only
   quote-to-execution drift such as the keeper's burn landing in between.
   The fork test proves quote == delivered output, so 2% never
   false-reverts.
5. **The modal owns execution** [inv: tx-busy-guard]. Origin: wagmi's
   isPending flips false when the hash returns, 3-5s before mining
   (2026-05-08 testnet incident) - a re-enabled button invites
   double-spends. The card button only opens
   `frontend/src/components/swap-progress-modal.tsx` and disables while it
   is open; every wallet popup is gated by modal step state (approve
   auto-advances into swap); trade params are snapshotted at open so live
   edits cannot change amounts mid-flight; closing is blocked mid-tx.
6. **MAX trades the exact balance bigint, never the display string.**
   Origin 2026-06-02: re-parsing a rounded display amount plus a hardcoded
   gas buffer made MAX fail with "insufficient funds". maxSelected trades
   userEth minus GAS_BUFFER (0.0001 ETH) on buy or the full token balance
   on sell; cleanAmount() renders the display string; maxSelected resets
   on hand-edit, side flip, and trade success.
7. **Fee surfacing.** The card footer shows "Protocol fee X% on this swap"
   from hook.calculateFee in `contracts/src/LineaDATHook.sol`: buys decay
   from 99% to the 10% DEFAULT_FEE at 100 bps/min (~89 min from launch),
   sells are a flat 10%. Values arrive via the shared snapshot
   (`frontend/src/app/api/snapshot/route.ts` feeBuy/feeSell)
   [inv: rpc-cost-not-per-visitor], launch defaults (99/10) as fallback.
   The hook skims the fee from the output currency (LDAT on buys, which it
   swaps to ETH itself; ETH directly on sells) and splits it in ETH per the
   capital loop - surfacing it keeps the 10% steady-state cost honest.
8. **The pool is a poolId inside a singleton, not a pair contract.** The
   LDAT pool lives inside the v4 PoolManager
   0x248083Fb965359d82b06C1F5322480Dcfc1AD857 as bytes32 keccak256(PoolKey);
   slot0 is read at a derived slot [inv: pool-id-derived-at-runtime]
   (`frontend/src/lib/abis/poolmanager.ts`). WHY this shapes the subsystem:
   aggregators index per-pair contract addresses, so DexScreener has no
   v4-on-Linea index at all and GeckoTerminal lists the pool under a dead
   pre-rename name - the in-app swap card plus native chart exist because
   of that blind spot (2026-06-01 decision). The card mounts in
   `frontend/src/components/strategy-dashboard.tsx` and
   `frontend/src/app/portfolio/page.tsx`; pre-launch the hook gate reverts
   every swap and quote (the chart card shows a countdown instead). Its
   reads ride the shared transport [inv: rpc-failover-infura-first].
9. **Break-glass path.** frontend/scripts/break-glass-swap.mjs (local,
   currently untracked) rebuilds the identical UR call as a viem CLI with
   hardcoded mainnet addresses, so trading survives the website being down.

## Owns

`frontend/src/lib/v4-swap.ts`, `frontend/src/components/swap-card.tsx`,
`frontend/src/components/swap-progress-modal.tsx`, `frontend/src/lib/abis/swapper.ts`,
`contracts/test/ForkQuoterSlippage.t.sol`, plus the UNIVERSAL_ROUTER /
PERMIT2 / V4_QUOTER / POOL_KEY constants in `frontend/src/lib/wagmi.ts`.

## Local invariants

[inv: tx-busy-guard] - marker at txBusy in `frontend/src/components/actions-card.tsx`;
this doc owns the rule's strongest form, the modal step-gating. Reads
[inv: transfers-distributor-gated],
[inv: distributor-whitelist-after-swapper-redeploy],
[inv: pool-id-derived-at-runtime], [inv: vercel-env-overrides],
[inv: rpc-failover-infura-first], [inv: rpc-cost-not-per-visitor].

## Verify

- Fork proof: `forge test --match-contract ForkQuoterSlippage --fork-url
  https://rpc.linea.build -vv` from the `contracts/foundry.toml` directory.
- Live fees: curl -s https://www.on-chaindat.com/api/snapshot | jq
  '.feeBuy,.feeSell' - both 1000 (10%) post-decay.
- Option C complete: cast call 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5
  "isDistributor(address)(bool)" 0xe784C85c308caFcA7A869d8938fe5DdfD027f696
  returns false; grep -rn "buyExactInput" frontend/src matches nothing.
- Dry run without the site: DRY_RUN=1 PRIVATE_KEY=0x... node
  scripts/break-glass-swap.mjs buy 0.001 (from frontend/) simulates only.

## Gotchas

- **A failed quote means a floorless swap.** quotedOut falls back to 0, so
  amountOutMinimum = 0 and the swap runs with NO slippage protection -
  deliberate pre-launch (the gate reverts the Quoter) but silent after: the
  estimate comes from the pool ratio, so the card looks normal.
- The Quoter already includes the hook fee, so SLIPPAGE_BPS buffers price
  movement only; never widen it to "fix" the 99% launch-window buy fee.
- POOL_KEY derives from ADDR.strategy/ADDR.hook: missing Vercel envs fall
  back to Base Sepolia zombies, a nonexistent pool [inv: vercel-env-overrides].
- `frontend/src/lib/abis/swapper.ts` is a historical filename: it holds the
  hook ABI (Trade event, calculateFee); no swapper ABI exists.
- estimatedOut is float math for display; nothing economic may consume it.
- The break-glass script duplicates encoding and addresses by hand; a pool
  or hook change must be mirrored there separately (untracked, forgettable).

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- project_swapper_decision.md - the option C record (commit 8dde5e1).
- feedback_swapper_distributor.md - the whitelist-after-redeploy rule.
- project_dexscreener_v4_linea.md - the aggregator blind spot in point 8.
- External decisions log at ~/projects/obsidian/Claude Brain/projects/
  LineaDAT/decisions.md: the 2026-05-08 double-click trap, the 2026-06-02
  MAX precision fix, the 2026-06-01 native-chart decision.
