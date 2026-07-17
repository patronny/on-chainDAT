# Module Playbook - how to build a new piece of LDAT

This is the how-to doc: eight end-to-end recipes for the kinds of modules
that get added to the LDAT stack most often. Rules that must never regress
live in `docs/INVARIANTS.md`; every `[inv: <name>]` reference below names a
register row there, not a summary of it. The deep deploy procedure is
`docs/60-deployment-runbook.md`; SEO context is `docs/90-seo-roadmap.md`.
The keeper is an EXTERNAL repo (Fly app lineadat-keeper); automation/keeper
is gitignored and absent locally - nothing in this repo builds it.

Each recipe: When to use / Steps (file -> what happens there) / Verify /
Ship.

## 1. New panel or card on the DAT page

When to use: add a stat card, table, or panel to the /dats/[address]
dashboard.

Steps:
1. Pick the data path FIRST. Shared on-chain state (same value for every
   visitor): consume `frontend/src/hooks/useSnapshot.ts` (or its alias
   `frontend/src/hooks/useStrategyStats.ts`); if the field is not in the
   snapshot yet, do recipe 2 first. Event history (bags/swaps): recipe 3 +
   `frontend/src/hooks/useIndexer.ts`. Never add a client-side viem read of
   shared state [inv: rpc-cost-not-per-visitor]; only per-wallet reads
   (balance, allowance) stay client-side via wagmi hooks.
2. `frontend/src/components/<name>.tsx` - the component, "use client".
   Follow `frontend/src/components/burned-card.tsx` (simple snapshot
   consumer) or `frontend/src/components/pool-liquidity-card.tsx`. Render
   only the card BODY: title/subtitle/collapse/drag chrome comes from
   CardShell via the grid registration in step 3, not from your component.
   If the panel fires a transaction, its button must stay disabled through
   isPending OR isConfirming, composed like the txBusy const in
   `frontend/src/components/actions-card.tsx` [inv: tx-busy-guard].
3. `frontend/src/components/strategy-dashboard.tsx` - register a
   DraggableSection `{ id, title, subtitle?, render }` in `leftSections`
   (wide column: chart + tables) or `rightSections` (narrow cards). The
   grid appends unknown ids at the END of a user's saved order; to force a
   position for existing users bump the storageKey version suffix (the
   right/mobile keys are already at v3 for exactly this reason).
4. USD figures: derive from useHoldingsTotals in
   `frontend/src/components/holdings-table.tsx` (currentFees + live onSale
   list prices) [inv: valuations-use-list-price]; ETH/USD comes from
   `frontend/src/hooks/useEthPrice.ts`. Never multiply bag token amounts by
   DEX spot.
5. `frontend/src/app/dats/[address]/page.tsx` needs no change - it renders
   StrategyHeader + StrategyDashboard and new sections flow in through the
   dashboard registration.

Verify: `npx next build` in frontend/ passes; check the card in both the
mobile grid (single column, Swap forced first) and the desktop columns, and
screenshot at 320/375/768/1024/1440 px [inv: theme-lock-responsive-matrix];
drag/collapse state persists across reload (localStorage).

Ship: commit + push the component + `frontend/src/components/strategy-dashboard.tsx`;
the Vercel project lineadat (root frontend/) auto-deploys from main.

## 2. New /api/snapshot field

When to use: a new piece of shared on-chain state that every visitor
displays (a contract read, a pool read, a quoter price).

Steps:
1. `frontend/src/app/api/snapshot/route.ts` - add the read to the
   `client.multicall` contracts array, or to the post-multicall
   `Promise.all` block if it depends on a multicall result (the
   bagMarketPriceWei quote needs the live bagSize, so it lives there). The
   result accessors `big(i)` / `str(i)` are INDEX-based: append at the END
   of the array, or re-check every index below your insertion point.
   Serialize into `body` as a decimal string. RPC goes through
   lineaServerTransport from `frontend/src/lib/rpc.ts`
   [inv: rpc-failover-infura-first]; pool storage reads use POOL_SLOT0
   derived from POOL_KEY, never a hardcoded id
   [inv: pool-id-derived-at-runtime]; burn-style metrics read
   balanceOf(DEAD), never a supply delta [inv: burn-reads-dead-balance].
2. Same file - do not touch the cache headers (s-maxage=15,
   stale-while-revalidate=30) or the query-param 308 guard above the RPC
   work: the guard is what keeps `?cb=` cache-busting from turning the edge
   cache into a per-request Infura amplifier.
3. `frontend/src/hooks/useSnapshot.ts` - add the field to the Snapshot type
   and parse it in fetchSnapshot with `b("<key>")` (or a string passthrough).
   All consumers then see it via useStrategyStats with no further wiring.
4. CDN implications: the new value reaches users within one edge window
   (~15-45s with SWR), and its RPC cost is one extra call per GLOBAL
   revalidation, not per visitor [inv: rpc-cost-not-per-visitor]. If a
   consumer needs it fresher than 15s, that is a design smell - do not
   lower s-maxage for one field.
5. Optional: if the field is a liveness signal, extend snap_live in
   `.github/scripts/monitor.py` to assert a meaningful value for it, not
   mere presence [inv: snapshot-live-data-validation].

Verify: `npm run dev` in frontend/, then `curl -s localhost:3000/api/snapshot`
shows the key with a plausible non-zero value; after deploy, curl the prod
route twice and confirm the second hit is edge-cached and the JSON still
parses in useSnapshot (no console BigInt errors).

Ship: commit + push the route + hook (+ monitor.py if touched); Vercel
auto-deploys; per the standing post-deploy habit confirm the
NEXT_PUBLIC_*_ADDRESS envs are intact [inv: vercel-env-overrides].

## 3. New indexer entity or event handler

When to use: index a new on-chain event into its own table (or extend an
existing table) and show it on the site.

Steps:
1. `automation/indexer/ponder.schema.ts` - add an onchainTable with indexes,
   following the `bag` / `swap` shapes (bigint for wei, integer for unix
   seconds, hex for hashes/addresses).
2. Event source: if the event comes from the already-indexed strategy/hook,
   make sure it exists in the hand-pruned ABI (`automation/indexer/abis/strategy.ts`
   or `automation/indexer/abis/hook.ts`). A new contract needs its own entry
   in the contracts block of `automation/indexer/ponder.config.ts` (address
   and startBlock come from env, not literals).
3. `automation/indexer/src/index.ts` - the `ponder.on("Contract:Event")`
   handler. Insert with `.onConflictDoNothing()` for replay safety, and
   handle out-of-order arrival the way the ERC20SoldByProtocol handler
   falls back to insert when Sold lands before Bought.
4. `automation/indexer/src/api/index.ts` - no change: `graphql({ db, schema })`
   auto-generates queries/filters/pagination for the new table. Run
   `npm run codegen` in automation/indexer/ to refresh
   `automation/indexer/generated/schema.graphql`.
5. Redeploy (mainnet app lineadat-indexer): FIRST bump
   PONDER_DATABASE_DIRECTORY to a fresh /data path (the env lives in
   `automation/indexer/fly.linea.toml`), THEN
   `fly deploy -c fly.linea.toml --app lineadat-indexer` from
   automation/indexer/ [inv: indexer-fresh-pglite-dir]. The resync from
   START_BLOCK burns RPC quota proportional to history - do it in a
   low-load window, and prune dead pglite dirs afterwards (the 2026-07-12
   ENOSPC crash-loop was old dirs filling the 3GB volume).
6. Frontend: add a fetch function to `frontend/src/lib/indexer.ts` (one
   POST helper, no GraphQL client lib) and a state hook to
   `frontend/src/hooks/useIndexer.ts`. The browser reaches the indexer ONLY
   through the same-origin proxy `frontend/src/app/api/indexer/route.ts`
   [inv: same-origin-proxies] - never put a fly.dev URL in client code.

Verify: locally `npx ponder start` with STRATEGY_ADDRESS / HOOK_ADDRESS /
START_BLOCK / PONDER_RPC_URL_59144 env set and query the new table at
localhost:42069/graphql; after deploy, machine logs show a clean backfill
with no MigrationError, and a POST to
https://www.on-chaindat.com/api/indexer returns the new entity; the monitor
indexer healthz check stays green.

Ship: commit + push automation/indexer + frontend changes; the Fly deploy
is manual (step 5), not CI.

## 4. New keeper contour or knob

When to use: a new autonomous loop (a new trigger, a new venue) or a
tunable parameter for the existing keeper.

Steps:
1. Keeper repo src/index.ts (EXTERNAL - Fly app lineadat-keeper, not in
   this repo) - implement the contour. Any swap executed on the Etherex CL
   router is quoted exact-out but EXECUTED exact-in, always
   [inv: exact-input-on-etherex]. A knob is an UPPER_SNAKE env var read at
   boot and set via `fly secrets set <NAME>=... -a lineadat-keeper` (names
   are fine in docs, values never).
2. Keeper repo /status endpoint - expose the new observable state as a
   field in the /status JSON next to the existing ones the monitor already
   consumes (alive, updatedAt, lastError, rpc, keeperEth, lastBagId,
   ethToTwapEth). A contour that is not visible in /status does not exist
   for ops.
3. This repo, `frontend/src/app/status/page.tsx` - surface the field on the
   ops dashboard. The browser reads it via the same-origin proxy
   `frontend/src/app/api/keeper-status/route.ts`, never fly.dev directly
   [inv: same-origin-proxies].
4. `.github/scripts/monitor.py` - wire a Telegram alert or good-news ping
   on the new field (recipe 5) so a broken contour pages instead of idling.
5. Deploy from the keeper repo with `fly deploy`; the app runs EXACTLY one
   machine, ever [inv: single-keeper-instance] - a second instance races
   nonces on the shared keeper EOA.

Verify: `curl -s https://www.on-chaindat.com/api/keeper-status` shows the
new field with a sane value; `fly machines list -a lineadat-keeper` shows
one machine; trigger the contour once (or wait a cycle) and confirm the
/status field and the monitor reaction both move.

Ship: the keeper change ships in its own repo; commit + push the status
page and monitor changes here, then redeploy the monitor (recipe 5 Ship).

## 5. New monitor alert

When to use: a new failure condition or good-news event should reach
Telegram.

Steps:
1. `.github/scripts/monitor.py` - add the check inside main(). Platform-wide
   checks (site, snapshot) sit before the DATS loop and route to the status
   bot (TG_TOKEN_STATUS); per-DAT checks go inside the `for dat in DATS`
   loop and route to that DAT's own bot (token_env, e.g. TG_TOKEN_LINEADAT).
   Use `al.check(token, key, bad, message)` - the Alerter dedupes, re-fires
   at most every REALERT_MIN while broken, and sends a recovery message on
   clear. One-shot good-news pings (new bag, burn) use `send()` with a
   previous-value comparison persisted in dstate.
2. Assert meaningful values, never envelope shape - blockNumber > 0,
   non-zero sqrtPriceX96, not "key exists" [inv: snapshot-live-data-validation].
   Debounce single-tick transients with a streak counter in dstate (the
   keeperErrStreak pattern: alert only at streak >= 2).
3. Only free endpoints (CDN snapshot, Fly /status, indexer healthz/graphql)
   - the monitor never spends Infura credits.
4. New secret: pick the env var NAME, set it on the Fly worker by name
   (`fly secrets set <NAME>=... -a lineadat-monitor`), add it to the
   documented list in the `automation/monitor/fly.toml` header comment, and
   mirror the same name as a GitHub Actions secret so the manual one-shot
   backup `.github/workflows/monitor.yml` keeps working. A whole new DAT
   channel is one entry in DATS plus one TG_TOKEN_* secret; the trades bot
   is shared.

Verify: run one-shot locally (`python3 .github/scripts/monitor.py` with the
TG_* env set, no MONITOR_LOOP) and see "monitor run complete"; force the
condition (or temporarily invert the predicate) and confirm the alert plus
its recovery message; a PING=true run sends deploy-confirmation to every
channel.

Ship: commit + push monitor.py, then redeploy the always-on worker from
repo root: `fly deploy . --config automation/monitor/fly.toml` (build
context is the repo root - the worker runs this same script in
MONITOR_LOOP mode); confirm the startup message from run_forever arrives.

## 6. New docs-site page

When to use: a new page under /docs (product doc, SEO pillar, FAQ-style
explainer).

Steps:
1. `frontend/src/app/docs/<slug>/page.tsx` - a server component exporting
   `metadata` (title + description) and the page. Follow
   `frontend/src/app/docs/what-is-an-onchain-dat/page.tsx`, including its
   two edit rules (third-party claims carry source links; LDAT claims are
   scoped to what the code does) and the JsonLd FAQ mirror if the page is
   question-shaped. The canonical is automatic: the root layout's
   `alternates.canonical: "./"` resolves per-route against metadataBase.
2. `frontend/src/lib/docs-nav.ts` - add the DocItem in reading order; this
   single source of truth drives the sidebar AND the prev/next links.
3. `frontend/src/lib/docs-search.ts` - append a DocSearchEntry (summary
   under 140 chars, href matching the nav route).
4. `frontend/src/app/sitemap.ts` - add the route to ROUTES, unless it is a
   stub/noindex page (yield-style pages stay out on purpose).
5. Subdomain: nothing to do. docs.on-chaindat.com/<slug> 308-redirects to
   www /docs/<slug> via `frontend/src/middleware.ts`
   [inv: docs-subdomain-308-not-rewrite]. Do NOT resurrect the rewrite-era
   per-segment special-file re-exports (a docs-level icon.tsx re-exporting
   the root icon was deleted with the 308); the root special files
   `frontend/src/app/icon.tsx` / `frontend/src/app/opengraph-image.tsx`
   cover the whole tree.
6. SEO ship checklist: sitemap entry (step 4); IndexNow fires by itself -
   `.github/workflows/indexnow.yml` runs `.github/scripts/indexnow.mjs` on
   push, which reads the LIVE sitemap and pings Bing/Yandex; never touch
   the key or `frontend/public/8152797bdb756f9c95f5ad2505b1a19b.txt`
   [inv: indexnow-key-immutable]. Google gets the URL via the GSC sitemap;
   request indexing per the flow in `docs/90-seo-roadmap.md`. Copy rules:
   [inv: repo-english-only], [inv: no-em-dash].

Verify: `npx next build` prerenders the route statically (it must appear in
the build output as static, with metadata in head); sidebar + prev/next
show the page; five-width screenshot pass
[inv: theme-lock-responsive-matrix]; after deploy
`curl -I https://docs.on-chaindat.com/<slug>` returns 308 to the www /docs
URL, the live sitemap.xml contains the page, and the IndexNow workflow run
logs HTTP 200/202.

Ship: commit + push - Vercel auto-deploys and the push itself triggers the
IndexNow workflow (its paths filter covers frontend/src/app and
frontend/public).

## 7. Contract impl upgrade / redeploy

When to use: change strategy logic behind the live UUPS proxy (impl
upgrade; proxy address unchanged) or, rarely, redeploy a proxy. Prefer the
impl upgrade; a proxy redeploy drags the full checklist in step 6 behind it.

Steps:
1. `contracts/src/LineaDATStrategy.sol` - implement, and bump the value
   returned by VERSION() (pure override; live value 4 since the on-chain
   LDAT rename). Do not design around tuning initialize-set parameters
   post-deploy [inv: buyincrement-immutable]; never weaken the transfer
   gate [inv: transfers-distributor-gated].
2. `contracts/test/` - full `forge test`, plus a fork test cloned from
   `contracts/test/ForkRenameUpgrade.t.sol`: upgrade against forked live
   Linea state and assert storage + behavior continuity across the switch.
3. Deploy the new implementation from the hot deployer with a script
   patterned on `contracts/script/UpgradeStrategyTwap.s.sol`, but SPLIT on
   mainnet: only `new LineaDATStrategy()` runs from the hot key; the
   `proxy.upgradeToAndCall(newImpl, "")` call is owner-only and the owner
   is the cold Keycard.
4. Keycard flow: build a single-file signing page in `tools/` following
   `tools/relay-whitelist-signer.html` / `tools/transfer-ownership-to-safe.html`
   (opened locally, no build step; encodes the exact calldata, the owner
   reviews and signs with the Keycard). The on-chain rename to LDAT
   (VERSION=4) is the proven precedent for this flow.
5. Post-upgrade (impl only): read VERSION() on-chain == new value; rerun
   the fork test against the now-live impl; watch one keeper cycle and
   `frontend/src/app/status/page.tsx` stay green.
6. Full proxy redeploy adds the whole post-redeploy checklist:
   [inv: fee-address-claim-after-redeploy] (deploy script step 6b in
   `contracts/script/Deploy.s.sol`);
   [inv: distributor-whitelist-after-swapper-redeploy] (moot for live LDAT,
   mandatory if a swapper exists); re-whitelist the TransferRelay,
   owner-signed [inv: transfers-distributor-gated]; set the new addresses
   in the Vercel envs via the REST API - the checked-in wagmi fallbacks are
   historical [inv: vercel-env-overrides]; the frontend pool id follows
   POOL_KEY automatically [inv: pool-id-derived-at-runtime]; point the
   indexer at the new addresses (STRATEGY_ADDRESS / HOOK_ADDRESS /
   START_BLOCK secrets) with a fresh database dir
   [inv: indexer-fresh-pglite-dir]; update the keeper's address envs
   (external repo).

Verify: on-chain VERSION read; /api/snapshot serves live non-zero data
[inv: snapshot-live-data-validation]; one real swap succeeds on the site;
`docs/60-deployment-runbook.md` is the deep runbook when in doubt.

Ship: commit + push contracts + the tools signing page; append the work
log entry in obsidian per the project convention (date, scope, tx hashes,
verification).

## 8. Launching a NEW DAT

When to use: a second strategy in the family. Next intended: AERODAT on
Base 8453 - a full-stack redeploy on another chain with its own treasury
engine, not a factory child of the Linea instance.

Steps:
1. Contracts, same chain: `contracts/src/LineaDATFactory.sol` -
   owner-only deployStrategy + ownerLaunchStrategy register a new proxy
   against the shared hook (the LDAT self-launch token had to be first).
   New chain (AERODAT): full stack patterned on
   `contracts/script/Deploy.s.sol`, with the hook CREATE2 salt mined via
   `contracts/script/MineHook.s.sol` (permission flags 0x2444).
2. Launch gate + fees: schedule the public trading open with
   hook.setScheduledLaunchTime(unixTs) BEFORE launch (it locks
   AlreadyLaunched after); claim the creator fee share
   [inv: fee-address-claim-after-redeploy]; seed single-sided liquidity
   (testnet pattern: `contracts/script/SeedLiquidityBaseSepolia.s.sol`).
3. Per-DAT route: `frontend/src/app/dats/[address]/page.tsx` currently
   hard-404s every address except ADDR.strategy and renders single-DAT
   components - extend it to an address -> DAT-config map so
   /dats/<newAddr> resolves. The countdown-or-chart split already
   generalizes: `frontend/src/components/chart-or-countdown.tsx` flips on
   hook deploymentTime from the snapshot, so a pre-launch DAT shows the
   countdown and cuts to the chart at launch; launches surface on the
   per-DAT page, there is no global /launch route. List the DAT in
   `frontend/src/components/dats-explorer.tsx`.
4. Snapshot: `frontend/src/app/api/snapshot/route.ts` reads one strategy -
   a second DAT needs a parameterized snapshot. Keep it CDN-cacheable: use
   a path segment, not a query string (the route 308s any query away)
   [inv: rpc-cost-not-per-visitor].
5. Indexer: a new Fly app (or a new contracts entry in
   `automation/indexer/ponder.config.ts`) with its own STRATEGY_ADDRESS /
   HOOK_ADDRESS / START_BLOCK secrets and a fresh database dir
   [inv: indexer-fresh-pglite-dir]; front it with a same-origin proxy like
   `frontend/src/app/api/indexer/route.ts` [inv: same-origin-proxies].
6. Keeper: its own single instance in the external keeper repo
   [inv: single-keeper-instance]. Venue swap semantics are per-venue:
   [inv: exact-input-on-etherex] is the Linea/Etherex rule - re-verify
   quote-vs-execute behavior on the new chain's venue before trusting it.
   AERODAT's veAERO active-management engine is its own contour (recipe 4).
7. Monitor: one new entry in DATS in `.github/scripts/monitor.py` plus one
   TG_TOKEN_* secret on lineadat-monitor (the trades bot is shared);
   redeploy the worker (recipe 5 Ship).
8. Frontend wiring: new NEXT_PUBLIC_*_ADDRESS envs via the Vercel REST API
   [inv: vercel-env-overrides]; add /dats/<address> to
   `frontend/src/app/sitemap.ts` (recipe 6 step 6 for the SEO tail).

Verify: pre-launch, /dats/<address> renders the countdown from the
scheduled launch time; at T0 it flips to the chart and a test swap
succeeds; keeper /status, indexer healthz, and snapshot all green on
`frontend/src/app/status/page.tsx`; the new Telegram channel receives the
monitor ping.

Ship: staged commits (contracts, automation, frontend) following
`docs/60-deployment-runbook.md`; work log entry in obsidian with addresses,
tx hashes, and the post-launch check results.

## Before you start

Read `docs/INVARIANTS.md` once. For every file you are about to touch, run
`git grep -n "INV:" <file>` to see which invariants already live there.
After editing any canon doc (this one included), run
`node scripts/docs-lint.mjs` - it checks backticked paths, invariant
references, and the dash/English rules mechanically.
