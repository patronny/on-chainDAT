# Market data and charts

Purpose: every market number a visitor sees - price, treasury, bag
progress, burn, the chart - without RPC cost scaling with visitor count.
Read `docs/ARCHITECTURE.md` first for the four planes; this doc goes one
level deeper into the CDN-cached snapshot, the card math, and the charts.

## How it works

1. **`/api/snapshot` - one server-side multicall for everyone**
   (`frontend/src/app/api/snapshot/route.ts`, runtime nodejs). Before it,
   every open browser ran the stats multicall plus countdown/fee/bag reads
   against the origin-locked frontend Infura key: RPC cost scaled LINEARLY
   with visitors, so a launch spike meant a 429 storm. (The route shipped
   2026-06-03, before launch; the launch-day 14.1M/15M Infura-credit near
   miss was driven by the since-disabled getLogs event-scan fallback on
   the frontend key, not this multicall path - see the work log.) The
   route reads the same data ONCE over the
   non-origin-locked ops key (`LINEA_RPC_URLS`, legacy
   `LINEA_RPC_URL_SERVER`; the frontend key 403s server-side) and answers
   `cache-control: public, s-maxage=15, stale-while-revalidate=30`, so
   Infura is hit about once per 15s window GLOBALLY
   [inv: rpc-cost-not-per-visitor]. One multicall returns the full strategy
   state (supply, bagSize, buyIncrement, priceMultiplier, currentFees,
   TWAP counters, lastBagId, availableFunds, getMaxPriceForBuy),
   treasuryUnderlying, burned = strategy balanceOf(0xdEaD)
   [inv: burn-reads-dead-balance], pool slot0 via
   PoolManager.extsload(POOL_SLOT0) (sqrtPriceX96 = low 160 bits), hook
   deploymentTime + calculateFee(buy/sell), and poolLineadat; blockNumber
   and the bag quote follow in parallel. Failed legs serialize as "0",
   never throw. Any query string is 308-bounced BEFORE RPC work: the CDN
   caches by full URL, so `?cb=<random>` would bypass the edge and amplify
   into Infura. Per-wallet reads (balances, allowance) stay client-side.
2. **Bag quote = Etherex CL QuoterV2 exactOutput.** quoteExactOutputSingle
   (quoter 0xE660C95E17884b6C81B01445EFC24556f8ABa037): WETH in, canonical
   $LINEA out, amount = live bagSize, tickSpacing 50 (the local ABI marks
   it `view` so it resolves via eth_call). `bagMarketPriceWei` is thus the
   ALL-IN cost of sourcing one 150k bag - pool fee and price impact
   included, what the keeper actually pays; quote exact-out, swap exact-in
   mirrors [inv: exact-input-on-etherex].
   `frontend/src/hooks/useBagMarketPriceEth.ts` just reads the snapshot
   field (testnet fallback: flat 0.02 ETH, faucet tLINEA has no market).
3. **Client polling.** `frontend/src/hooks/useSnapshot.ts`: React Query,
   refetchInterval 15s matching the edge window, staleTime 12s; consumers
   in a tab dedupe into one fetch, the edge dedupes across users.
   `frontend/src/hooks/useStrategyStats.ts` is the compat shim over it
   (it WAS the per-browser multicall; return shape kept). ETH/USD:
   DefiLlama coins.llama.fi via `frontend/src/hooks/useEthPrice.ts` (60s,
   keyless); on failure it returns 0 and USD figures hide, never error.
4. **Card math** (`frontend/src/components/fundings-card.tsx`). Fundings
   title USD = (currentFees + all onSale bags at their 1.2x LIST price via
   useHoldingsTotals in `frontend/src/components/holdings-table.tsx`) x
   ETH/USD [inv: valuations-use-list-price]. Bot intent: bagUsd = bag
   quote x ETH/USD; the displayed "$LINEA price" = bagUsd / 150k - a
   quote-derived all-in unit price, slightly above spot by construction,
   do not "fix" it to spot. "Current bid" = availableFunds = on-chain
   min(currentFees, getMaxPriceForBuy()), the pot capped by the 0.005
   ETH/block ramp [inv: buyincrement-immutable]. Progress = currentFees /
   bag quote, capped: it deliberately FREEZES at 100% and ignores the
   keeper's profit margin; it resets when a buy drains currentFees.
   `frontend/src/components/burned-card.tsx` renders burned / totalSupply.
5. **The live chart is a GeckoTerminal embed.**
   `frontend/src/components/chart-or-countdown.tsx` gates on hook
   deploymentTime (a failed read shows the countdown, never the chart);
   post-launch it mounts
   `frontend/src/components/gecko-chart.tsx`, an iframe addressed by the
   v4 bytes32 POOL_ID, so a redeploy auto-retargets it. GeckoTerminal
   indexes v4-on-Linea; DexScreener does not, hence
   `frontend/src/components/dex-chart.tsx` sits unmounted.
6. **The native chart is kept but unmounted.**
   `frontend/src/components/price-chart.tsx` (lightweight-charts) was the
   launch-day chart and remains the template for future DATs: indexer
   `swap` rows via useSwaps(500) in `frontend/src/hooks/useIndexer.ts`
   (12s poll, probe-gated) plus a live tail from the current sqrtPriceX96,
   bucketed client-side into OHLC + volume; MCap multiplies by circulating
   supply = totalSupply - burned. Two hard-won rules live in it:
   (a) corrupt-tick defense [inv: chart-corrupt-tick-defense] via
   `frontend/src/lib/chart-scale.ts` - drop only multi-order-of-magnitude
   junk (1e4x band anchored on the LIVE pool price, else the median), and
   frame the y-axis via per-series autoscaleInfoProvider on the 2nd..98th
   percentile with a non-negative floor (one anomalous sqrtPriceX96
   otherwise blows the autoscale open and flattens the real line at zero);
   (b) fitContent separation - the data effect only calls setData
   (preserves the viewport), fitContent fires only on first data or a
   user-picked interval/range: refitting per poll flickered the layout
   every 12s (stale barSpacing read).
7. **RPC transport** (`frontend/src/lib/rpc.ts`). One ordered viem
   fallback(): Infura first, drpc/publicnode/1rpc always appended,
   per-request failover and auto-revert - built after the 2026-06-13
   Infura Linea outage took the site down [inv: rpc-failover-infura-first].
   lineaServerTransport (ops key envs) serves this route;
   lineaClientTransport (`NEXT_PUBLIC_LINEA_RPC_URLS`) serves wagmi reads.
8. **POOL_ID / POOL_SLOT0** (`frontend/src/lib/abis/poolmanager.ts`) are
   derived at runtime: POOL_ID = keccak256(abi.encode(POOL_KEY)),
   POOL_SLOT0 = keccak256(abi.encode(poolId, 6)) (slot 6 = the _pools
   mapping) [inv: pool-id-derived-at-runtime]. Once hardcoded, they
   survived a redeploy pointing at a zombie pool, splitting live slot0
   from the indexer and breaking the 24h change widget. POOL_KEY builds
   from ADDR, which Vercel envs override [inv: vercel-env-overrides].

## Owns

`frontend/src/app/api/snapshot/route.ts`, `frontend/src/hooks/useSnapshot.ts`,
`frontend/src/hooks/useStrategyStats.ts`, `frontend/src/hooks/useEthPrice.ts`,
`frontend/src/hooks/useBagMarketPriceEth.ts`, `frontend/src/lib/rpc.ts`,
`frontend/src/lib/chart-scale.ts`, `frontend/src/lib/abis/poolmanager.ts`,
`frontend/src/components/fundings-card.tsx`, `frontend/src/components/burned-card.tsx`,
`frontend/src/components/chart-or-countdown.tsx`, `frontend/src/components/gecko-chart.tsx`,
`frontend/src/components/price-chart.tsx`, `frontend/src/components/dex-chart.tsx`.

## Local invariants

Owns [inv: rpc-cost-not-per-visitor], [inv: rpc-failover-infura-first],
[inv: chart-corrupt-tick-defense], [inv: pool-id-derived-at-runtime],
[inv: burn-reads-dead-balance], and [inv: valuations-use-list-price]
(marker at useHoldingsTotals; the indexer doc's bag tables share it).
Reads [inv: buyincrement-immutable], [inv: exact-input-on-etherex],
[inv: vercel-env-overrides], [inv: same-origin-proxies], and
[inv: snapshot-live-data-validation] (the ops monitor asserts it here).

## Verify

- `curl -s https://www.on-chaindat.com/api/snapshot | jq -r '.blockNumber, .sqrtPriceX96, .bagMarketPriceWei'`
  gives three non-zero values [inv: snapshot-live-data-validation].
- `curl -s -o /dev/null -w "%{http_code}" "https://www.on-chaindat.com/api/snapshot?cb=1"`
  gives 308 (the cache-bypass bounce works).
- Two `curl -sI` of the bare path within 15s: the second shows
  `x-vercel-cache: HIT`.
- `grep -rn "createPublicClient" frontend/src` - every hit routes Linea
  mainnet reads through lineaServerTransport or lineaClientTransport
  (`frontend/src/app/status/page.tsx` keeps a raw-URL branch, but only
  for the legacy Base Sepolia testnet path).
- The chart card's "open pool" link resolves on GeckoTerminal; "pool not
  found" there means the address envs (hence POOL_ID) drifted.

## Gotchas

- A frozen "100% to next bag" bar with an idle keeper is designed, not an
  incident: the bar ignores the keeper's profit margin.
- USD figures disappearing while ETH numbers stay live means DefiLlama is
  unreachable (useEthPrice returned 0), not an RPC problem.
- The snapshot serializes failed multicall legs as "0" with HTTP 200 - do
  not health-check this route by status code alone.
- GeckoTerminal listing metadata (token name/logo) is edited via their
  update-token-info form; a wrong NAME on the embed is not POOL_ID drift.
