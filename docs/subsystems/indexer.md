# Indexer

Purpose: turn the LDAT contracts' event stream into queryable history - who
bought which bag, who swapped what and when - so the site renders tables
without any browser ever running an on-chain log scan. Read
`docs/ARCHITECTURE.md` first for where the indexer sits between the contracts
and the frontend; this doc goes one level deeper into the Ponder app, its
Fly deployment, and the browser path to it.

## How it works

1. **A Ponder 0.16 app** (`automation/indexer/`), chain-switchable via env
   so one codebase serves both the Base Sepolia testnet (`fly.toml`, app
   lineastr-indexer) and Linea mainnet (`fly.linea.toml`, app
   lineadat-indexer). `automation/indexer/ponder.config.ts` tracks exactly
   two contracts from `START_BLOCK` forward: the strategy proxy and the v4
   hook; addresses, RPC, and START_BLOCK come from Fly secrets.
2. **Two tables** (`automation/indexer/ponder.schema.ts`, handlers in
   `automation/indexer/src/index.ts`). `bag`: one row per
   `ERC20BoughtByProtocol` (stores paid and listPrice = 1.2x paid), patched with
   soldFor/soldAt/buyer on `ERC20SoldByProtocol` - joined by bagId, with
   an insert fallback if Sold is somehow processed before Bought. `swap`:
   one row per hook `Trade` event; the sign of the ETH-side BalanceDelta
   decides buy vs sell. The keeper's TWAP buy-and-burn swaps on the same
   hooked pool, so its Trade events land here as buys by the keeper EOA -
   intentional (real on-chain volume), do not filter them out.
3. **GraphQL comes for free.** `automation/indexer/src/api/index.ts` is a
   Hono app mounting Ponder's auto-generated `graphql({ db, schema })` at
   `/` and `/graphql` (queries `bags`/`swaps` with filters, ordering,
   pagination) plus a `/healthz` JSON probe. The CORS middleware must stay
   registered BEFORE the GraphQL handlers or its headers never attach.
4. **Fly app lineadat-indexer**: one machine (08057deb0253e8, fra, 1 GB
   RAM - 512 MB got OOM-killed during initial sync), volume
   lineadat_indexer_data at /data, extended 1 GB -> 3 GB after the
   2026-07-12 ENOSPC incident (dead pglite dirs plus un-checkpointed
   PGlite WAL filled the volume; the machine crash-looped on WAL init).
   The health check carries a 15m grace period because Ponder does not
   open the HTTP port until historical sync finishes - a 60s grace killed
   the machine mid-sync on 2026-05-08. Scaling out is allowed here, never
   for the keeper [inv: single-keeper-instance].
5. **pglite directory rules.** The database is PGlite (Postgres-in-WASM)
   in `PONDER_DATABASE_DIRECTORY`; the LIVE dir is a Fly secret
   (/data/pglite-lineadat-2) which OVERRIDES the Dockerfile and toml env
   defaults. Every code redeploy bumps it to a fresh path
   [inv: indexer-fresh-pglite-dir]: Ponder 0.16 refuses to reuse a schema
   written by a different app (MigrationError crash-loop, INC-7 in
   `obsidian/INCIDENTS.md`). The fresh dir triggers a full resync from
   START_BLOCK - cost grows with chain history, so schedule a low-load
   window - and old dirs must then be pruned; leaving them around is
   exactly what filled the 1 GB volume.
6. **RPC config is a comma-separated list.** `PONDER_RPC_URL_<chainId>`
   may hold multiple URLs which the config splits into Ponder's fallback
   array (added after a 2026-05-08 publicnode outage blocked the indexer
   for hours); the mainnet secret is ordered Infura-first, matching
   [inv: rpc-failover-infura-first]. Head-polling is throttled to 2000 ms
   (`PONDER_POLLING_INTERVAL_MS`): Ponder's 1000 ms default alone was
   ~80% of the daily Infura credit bill.
7. **The browser never talks to Fly.** All client traffic goes through the
   same-origin `frontend/src/app/api/indexer/route.ts` proxy (POST
   forwards GraphQL, GET forwards /healthz for the /status page)
   [inv: same-origin-proxies]: fly.dev is unreachable from sanctioned
   regions, and `runtime = "nodejs"` is load-bearing so the outbound
   fetch leaves from a fixed Vercel region. `frontend/src/lib/indexer.ts`
   is the main client (the /status page also posts its own totalCount
   query and healthz GET straight to the proxy): 10s response caches, a
   probed `usable` gate (`frontend/src/hooks/useIndexer.ts`), and
   timeouts raised at launch (probe 6s, fetch 8s) - the old 1.5s probe
   flapped under load, and each flap fired a per-tab on-chain getLogs
   scan. That fallback is deleted for good: when the indexer is down,
   tables render "unavailable" instead [inv: rpc-cost-not-per-visitor].
8. **What reads it.** `swap` rows feed the LAST SWAPS table
   (`frontend/src/components/paginated-swaps-table.tsx`), the 24h volume
   stat (`frontend/src/components/strategy-header.tsx`), the 24h change
   baseline (`frontend/src/hooks/usePriceChange24h.ts`), and portfolio
   cost basis (`frontend/src/hooks/useAvgCostBasis.ts`). `bag` rows feed
   the holdings and sales tables, valued at list price
   [inv: valuations-use-list-price]. The price chart is NO LONGER a
   consumer: post-launch `frontend/src/components/chart-or-countdown.tsx`
   renders the GeckoTerminal embed; the indexer-fed
   `frontend/src/components/price-chart.tsx` stays in the tree unmounted.
9. **Disk self-guard.** The always-on monitor (`.github/scripts/monitor.py`,
   `indexer_disk_guard`) measures /data every ~5 min via the Fly Machines
   API (app-scoped FLY_API_TOKEN): warn at 70%, auto-restart at 85% (a
   clean restart checkpoints the WAL, reclaiming space) with a 30 min
   cooldown, then a human-escalation latch if restarting does not help -
   that means real data growth and the volume needs extending.

## Owns

`automation/indexer/ponder.config.ts`, `automation/indexer/ponder.schema.ts`,
`automation/indexer/src/index.ts`, `automation/indexer/src/api/index.ts`,
`automation/indexer/abis/strategy.ts`, `automation/indexer/abis/hook.ts`,
`automation/indexer/Dockerfile`, `automation/indexer/fly.toml`,
`automation/indexer/fly.linea.toml`, `automation/indexer/README.md`,
`frontend/src/app/api/indexer/route.ts`, `frontend/src/lib/indexer.ts`,
`frontend/src/hooks/useIndexer.ts`.

## Local invariants

[inv: indexer-fresh-pglite-dir] - marker at the database block of
`automation/indexer/ponder.config.ts`. Shares [inv: same-origin-proxies]
and [inv: rpc-cost-not-per-visitor] with the frontend (this doc owns the
proxy route and client they gate); reads [inv: rpc-failover-infura-first],
[inv: valuations-use-list-price], [inv: single-keeper-instance] as context.

## Data artifacts

The pglite DB on the Fly volume: derived, disposable, never committed -
fully re-derivable from chain; daily Fly volume snapshots (5-day retention,
restore runbook in the gitignored obsidian/ notes) shortcut a resync.
Codegen output `automation/indexer/generated/schema.graphql` is gitignored
(`automation/indexer/.gitignore`) and rebuilt by Ponder on start.

## Verify

- `curl -s -o /dev/null -w "%{http_code}" https://lineadat-indexer.fly.dev/healthz`
  gives 200 (direct Fly; fails from sanctioned regions - use the proxy).
- `curl -s -X POST https://www.on-chaindat.com/api/indexer -H 'content-type: application/json' -d '{"query":"{ swaps { totalCount } }"}'`
  gives JSON with a growing totalCount (proves proxy + indexer + sync).
- Cross-check bags against chain: cast call the proxy's lastBagId() on
  https://rpc.linea.build; it should match the highest bagId in a
  `{ bags { items { bagId } } }` query.
- Monitor log (fly logs -a lineadat-monitor) prints "indexer /data N% used"
  every ~5 min; silence means the disk guard itself is broken.
- On the site: LAST SWAPS shows fresh rows and 24h volume is a number, not
  a dash (a dash means the indexer is unreachable).

## Gotchas

- `automation/indexer/fly.toml` is the TESTNET app. A bare `fly deploy`
  from that directory targets lineastr-indexer; mainnet deploys are always
  `fly deploy -c fly.linea.toml --app lineadat-indexer`, AFTER bumping the
  database dir per [inv: indexer-fresh-pglite-dir].
- The checked-in defaults (addresses, START_BLOCK, database dir) are stale
  testnet/rehearsal values on purpose; production truth lives in Fly
  secrets, which silently override Dockerfile ENV and toml `[env]`.
- A syncing indexer is invisible, not broken: after a fresh-dir redeploy,
  /healthz fails until the historical resync completes (minutes to tens of
  minutes, growing with chain age). Restarting it restarts the sync.
- `INDEXER_URL` in `frontend/src/lib/indexer.ts` is the literal string
  "/api/indexer". Never repoint it at a fly.dev host: that reintroduces
  the sanctioned-region blackout AND ships the upstream host in the client
  bundle. The real URL belongs only in the proxy route's server-side env.
