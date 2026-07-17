# Keeper (external repo)

Purpose: the economic engine. A profit-gated arbitrageur EOA that keeps the
DAT's fee capital cycling - buying bags into the treasury, closing listed
bags, triggering the burn - until community bots do it instead. The code does
NOT live in this repo: private repo at ~/Desktop/lineadat-keeper, deployed as
Fly app lineadat-keeper (one machine, region fra). Read `docs/ARCHITECTURE.md`
first for where the keeper sits in the capital cycle - this doc records the
CONTRACT between the two repos: which on-chain functions it calls, the exact
profit gates, the env knobs, and the /status surface this repo consumes.

## How it works

1. **Permissionless calls only - the keeper has no on-chain privileges.**
   Each 6s tick (POLL_INTERVAL_MS=6000, ~2-3 Linea blocks) it evaluates
   three actions against the live Etherex CL LINEA/WETH pool and calls the
   strategy proxy directly: buyTokens(), sellTokens(bagId) (payable),
   processTokenTwap(). The deployed `contracts/src/LineaDATBot.sol` is
   deliberately NOT used: a plain EOA exercises the exact path community
   bots will use and keeps profit on the operator EOA, not in a contract.
   Failure mode is benign: keeper down = zero funds lost - fees keep
   accruing at the fixed drip [inv: buyincrement-immutable]; the keeper
   catches up on restart.
2. **One Multicall3 aggregate3 eth_call per tick (the "snapshot").** All
   evaluation state - strategy getters, keeper ETH/LINEA balances, block
   number, basefee, both Etherex QuoterV2 quotes, the onSale scan - is
   batched into a single aggregate3. WHY: Infura bills per method; ~25 reads
   collapsed into one cut credit use ~20x, which is what makes a 6s poll
   affordable. Only rare ACTION ticks add fresh reads. The onSale scan reads
   up to 2000 recent bag ids, cheapest-first, top SCAN_DEPTH evaluated.
3. **BUY gate (bag cheaper than the fees pot).** projected = availableFunds
   - bagCost * (1 + SLIPPAGE_BPS/10000) - gas; act iff projected >=
   MIN_PROFIT_WEI and the spend <= MAX_ACQUIRE_ETH_WEI. bagCost is the
   exact-OUTPUT quote for bagSize LINEA; gas = max(2*basefee, 0.05 gwei) *
   800k units (floored so a 0-basefee read never zeroes gas). Execution:
   wrap ETH, exact-INPUT swap requiring >= bagSize out, approve,
   buyTokens(). Right before committing it re-reads availableFunds and
   bagSize: a competing permissionless buy can drain the pot mid-tick, and
   buyTokens would then revert (NoZeroBuys) or, worse, SUCCEED paying less
   than the LINEA cost. On either signal the keeper aborts and sells the
   acquired LINEA straight back to ETH - a bounded spread cost, not a loss.
4. **Exact-input only on Etherex** [inv: exact-input-on-etherex]. The
   router answers exact-output QUOTES but reverts every exact-output SWAP
   (proven on launch day 2026-06-09); stranded WETH from those reverts once
   drained the keeper, so the buy path unwraps WETH on any swap failure.
5. **SELL gate (listed bag worth more on market).** projected =
   marketProceeds - listPrice - gas >= MIN_PROFIT_WEI (gas at 700k units,
   same price formula); marketProceeds is the exact-input quote for selling
   bagSize LINEA. Execution: sellTokens{value: listPrice}(bagId), then swap
   the received LINEA to ETH. The listPrice ETH flows into ethToTwap,
   funding the burn, and makes [inv: valuations-use-list-price] honest.
6. **TWAP gate (the burn).** ethToTwap > 0 AND blockNow >= lastTwapBlock +
   twapDelayInBlocks, then processTokenTwap() with a 1.5M gasLimit (the
   call nests unlock -> callback -> swap -> afterSwap -> swap-back). The
   caller earns the 0.5% reward (`contracts/src/BaseStrategy.sol`); bought
   tokens land on DEAD, measured per [inv: burn-reads-dead-balance].
7. **Dust sweep keeps the keeper ETH-only.** Exact-input buys overshoot
   bagSize slightly; on idle ticks leftover LINEA above SWEEP_MIN_LINEA_WEI
   is swept back to ETH when proceeds beat gas - inventory never compounds.
8. **RPC failover, Infura-first - the keeper's own copy of the rule**
   [inv: rpc-failover-infura-first]. rpcChain = [RPC_URL secret, then
   RPC_FALLBACK_URLS]; rotate after 2 consecutive failed ticks, retry the
   primary after 50 clean ticks (~5 min). An overlap guard never starts a
   new tick while the previous one is in flight (action txs span blocks).
9. **Tuning is off-chain env - reversible, no Keycard.** Production values
   live in the keeper repo's fly.toml [env]: MIN_PROFIT_WEI, SLIPPAGE_BPS,
   MAX_ACQUIRE_ETH_WEI, POLL_INTERVAL_MS, SCAN_DEPTH, RPC_FALLBACK_URLS.
   ENABLE_BUY / ENABLE_SELL / ENABLE_TWAP / ENABLE_SWEEP ("false" disables
   one loop) and SWEEP_MIN_LINEA_WEI exist but ride code defaults (all
   enabled, 1 LINEA), not fly.toml. Secrets (RPC_URL, KEEPER_PK,
   STRATEGY_ADDR - names only) go via fly secrets set (restarts the
   machine). Code defaults are rehearsal-scale - fly.toml wins. On-chain
   params (twapIncrement, twapDelayInBlocks, bagSize) are Keycard territory.
10. **/status is the public health surface.** GET /status returns JSON: ok,
    alive (false when no tick landed within 4x the poll interval), chain,
    updatedAt, tick, availableFundsEth, currentFeesEth, ethToTwapEth,
    lastBagId, bagSizeEth, bagMarketCostEth, lineaPriceEth, buyEdgeEth
    (the BUY gate's exact projected value - a buy fires once it clears
    MIN_PROFIT_WEI), keeperEth, keeperLinea, lastAction, lastError,
    enabled{buy,sell,twap}, pollIntervalMs, rpc (host only, never the keyed
    URL). GET /healthz backs the Fly HTTP check. The browser never hits
    fly.dev: `frontend/src/app/status/page.tsx` reads it via the same-origin
    proxy `frontend/src/app/api/keeper-status/route.ts`
    [inv: same-origin-proxies]; `.github/scripts/monitor.py` polls Fly
    directly and pages Telegram on alive=false, a debounced 2-tick
    lastError streak, staleness, RPC failover, and low keeper balance.

## Owns

Nothing tracked in this repo - the subsystem's code is external
(src/index.ts, fly.toml, Dockerfile in ~/Desktop/lineadat-keeper). In-repo
touchpoints owned here: `frontend/src/app/api/keeper-status/route.ts` (the
proxy) and the keeper checks in `.github/scripts/monitor.py`. Ops runbook:
obsidian/Keeper Ops Guide.md (gitignored, local).

## Local invariants

Owns [inv: exact-input-on-etherex] and [inv: single-keeper-instance], both
flagged "(external)" in `docs/INVARIANTS.md`: their markers live in the
keeper repo and its Fly config. Reads [inv: buyincrement-immutable],
[inv: rpc-failover-infura-first], [inv: same-origin-proxies],
[inv: valuations-use-list-price], [inv: burn-reads-dead-balance].

## Verify

- curl -s https://lineadat-keeper.fly.dev/status | jq '.alive,.lastError'
  gives true / null; updatedAt within ~10-15s of now.
- curl -s https://www.on-chaindat.com/api/keeper-status returns the same
  JSON via the proxy (502 keeper_proxy_failed = Fly upstream down).
- fly machines list -a lineadat-keeper shows exactly ONE machine
  [inv: single-keeper-instance].
- fly logs -a lineadat-keeper: one state line per tick; idle ticks log "no
  profitable action this tick" (normal).
- Read-only dry run from the keeper repo: tsx src/index.ts --status prints
  state plus the buy/sell gates' projectedProfit and executes nothing.

## Gotchas

- Negative buyEdgeEth is health, not sickness: the keeper is designed to
  wait until the fee drip out-runs the market price of a bag.
- NEVER start a second machine or run a local copy against mainnet - both
  share the keeper EOA and race nonces [inv: single-keeper-instance].
  Scale the indexer/frontend, never the keeper.
- The Infura quota is account-wide: a request storm on any other key can
  starve the keeper too. Canary: RPC-shaped lastError.
- keeperLinea near bagSize = a stranded half-round; read the logs - the
  sweep runs only on idle ticks and never touches a bag mid-round.
- The gas half of the profit gate assumes Linea's priority fee stays ~0 (2x
  basefee deliberately over-estimates). If Linea grows a real priority-fee
  market, pin the action txs' gas price or widen MIN_PROFIT_WEI (comment at
  gasCostFromBasefee in the keeper's src/index.ts).
- /status is CORS-open by design - public on-chain data plus liveness
  only. Never add fields that leak secrets or operator info.

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- project_keeper_etherex_exactinput.md - the launch-day exact-output revert.
- project_rpc_resilience.md - the 2026-06-13 Infura Linea outage behind
  every Infura-first failover chain, keeper included.
- project_ops_monitor.md - the always-on Fly monitor watching /status.
