# Invariants - do not break these

What this is: the single authoritative register of rules that must never
regress. Severity: hard = breaks prod/funds/data honesty; strong = regression
users or ops notice; soft = settled preference.

Marker convention: every in-repo invariant has a greppable comment marker
`INV:<name>` at its enforcement site (or, for convention-only rules, at the
most likely edit site). Find one with `git grep -n "INV:<name>"`. The
mechanical register<->marker match is checked by `node scripts/docs-lint.mjs`.
Invariants whose Enforced-by cell contains "(external)" live outside this repo
(keeper repo, Fly config) and carry no in-repo marker; the lint skips them.
Line numbers are never used here - they rot; markers do not.

Adding an invariant: add a table row + a details subsection + the INV marker
in code, then run `node scripts/docs-lint.mjs`.

## Register

| # | Invariant | Rule | Enforced by | Severity |
|---|-----------|------|-------------|----------|
| 1 | buyincrement-immutable | buyIncrement (live LDAT value 0.005 ETH/block) is assigned once in initialize and has no setter; never plan tuning, keeper math, or docs copy around changing it post-deploy | `contracts/src/BaseStrategy.sol` (marker) | strong |
| 2 | transfers-distributor-gated | Wallet-to-wallet token transfers revert unless from/to is a whitelisted distributor (or mint / poolManager with hook-set transient allowance); the TransferRelay whitelist is the only user transfer path; never remove the gate or silently un-whitelist the relay, and docs must disclose the whitelist | `contracts/src/BaseStrategy.sol` _afterTokenTransfer (marker) | hard |
| 3 | distributor-whitelist-after-swapper-redeploy | After any Strategy/Swapper redeploy call Strategy.setDistributor(swapper, true) or every sell reverts; moot for live LDAT (option C has no swapper), mandatory for any future DAT that ships one | `contracts/src/BaseStrategy.sol` setDistributor (marker; convention) | hard |
| 4 | fee-address-claim-after-redeploy | After every proxy redeploy call hook.adminUpdateFeeAddress(proxy, creator) or the 10% creator share silently merges into treasury (90/10 instead of 80/20) | `contracts/script/Deploy.s.sol` step 6b (marker) | hard |
| 5 | exact-input-on-etherex | The Etherex CL router supports exact-output quotes but reverts every exact-output swap; the keeper quotes exact-out and executes exact-in, always | keeper repo src/index.ts (external) | hard |
| 6 | single-keeper-instance | Exactly one keeper machine ever runs; a second copy races nonces and double-sends txs; scale only the indexer | Fly app lineadat-keeper, single machine (external) | hard |
| 7 | valuations-use-list-price | Treasury/holdings USD metrics sum the live onSale LIST prices (cost x 1.2, what the DAT will collect) plus currentFees, never DEX spot value of the bags | `frontend/src/components/holdings-table.tsx` useHoldingsTotals (marker) | hard |
| 8 | burn-reads-dead-balance | Burned amount = token.balanceOf(0xdEaD); buy-and-burn sends swap output to DEAD_ADDRESS without reducing totalSupply, so any supply-delta computation reads 0 forever | `frontend/src/app/api/snapshot/route.ts` DEAD const (marker) | hard |
| 9 | pool-id-derived-at-runtime | POOL_ID and POOL_SLOT0 are derived at runtime from POOL_KEY (keccak256 of the PoolKey, then slot-6 mapping), never hardcoded; a hardcoded id survives contract redeploys pointing at a zombie pool | `frontend/src/lib/wagmi.ts` POOL_KEY (marker) | strong |
| 10 | rpc-failover-infura-first | All frontend RPC goes through the shared viem fallback transport (Infura first, public pool drpc/publicnode/1rpc appended, per-request auto-failover and auto-revert); never a raw single-URL client | `frontend/src/lib/rpc.ts` buildTransport (marker) | hard |
| 11 | rpc-cost-not-per-visitor | Shared on-chain state is read once server-side via the CDN-cached /api/snapshot route; event tables are indexer-only; never reintroduce a per-visitor eth_getLogs fallback or per-browser multicalls of shared state | `frontend/src/lib/utils.ts` header note (marker) | hard |
| 12 | same-origin-proxies | The browser reaches the indexer and keeper status ONLY via same-origin /api/indexer and /api/keeper-status (nodejs runtime, not edge), never fly.dev directly; the proxies are load-bearing for sanctioned regions and must survive every refactor | `frontend/src/lib/indexer.ts` INDEXER_URL (marker) | hard |
| 13 | vercel-env-overrides | NEXT_PUBLIC_*_ADDRESS Vercel envs override the wagmi.ts fallbacks and are load-bearing (the checked-in FALLBACK_STRATEGY is a dead pre-launch address); verify them after every redeploy; set values via the Vercel REST API, never `vercel env add` (it stores EMPTY values) | `frontend/src/lib/wagmi.ts` ADDR (marker) | hard |
| 14 | indexer-fresh-pglite-dir | Every indexer code redeploy bumps PONDER_DATABASE_DIRECTORY to a fresh path before `fly deploy` or Ponder crash-loops with MigrationError; the resync burns RPC quota proportional to history, so do it in a low-load window | `automation/indexer/ponder.config.ts` database block (marker; convention) | strong |
| 15 | chart-corrupt-tick-defense | The price chart drops multi-order-of-magnitude junk ticks via a sanity band anchored on the live pool price AND frames the y-axis on a percentile band with a non-negative floor, so one corrupt sqrtPriceX96 can neither spike nor invert the chart | `frontend/src/lib/chart-scale.ts` inPriceBand/robustPriceRange (marker) | strong |
| 16 | tx-busy-guard | Every button that fires a tx stays disabled through isPending OR isConfirming (or the modal-step equivalent), never isPending alone; the hash returns 3-5s before mining and a re-enabled button invites double-submits | `frontend/src/components/actions-card.tsx` txBusy (marker) | strong |
| 17 | snapshot-live-data-validation | Health/monitor checks assert meaningful values (blockNumber > 0, non-zero sqrtPriceX96), never mere field presence; a structurally-valid all-zeros payload must alert | `.github/scripts/monitor.py` snap_live (marker) | strong |
| 18 | theme-lock-responsive-matrix | Single locked cyberpunk theme; every UI change is verified at 320/375/768/1024/1440 px before shipping | `frontend/src/app/globals.css` (marker; convention) | strong |
| 19 | docs-subdomain-308-not-rewrite | docs.on-chaindat.com 308-redirects to www.on-chaindat.com/docs/*, never rewrites; a rewrite served byte-identical pages on two hosts with a broken canonical | `frontend/src/middleware.ts` (marker) | strong |
| 20 | indexnow-key-immutable | Never regenerate the IndexNow key (the KEY const and its public key file); Bing already trusts it and a new key resets that validation | `.github/scripts/indexnow.mjs` KEY (marker) | strong |
| 21 | no-em-dash | No em dash (U+2014) or en dash (U+2013) in any repo file or agent output - prose, UI text, code, comments, commits; hyphen only | `scripts/docs-lint.mjs` DASHES check, exit 1 (marker) | hard |
| 22 | repo-english-only | All repo content is strictly English (docs, code comments, specs, commits); Russian lives only in chat and the local agent config, never in repo files | `scripts/docs-lint.mjs` CYRIL check, exit 1 (marker) | hard |

## Details

### 1. buyincrement-immutable
Rule: `buyIncrement` is a plain state variable assigned only inside
initialize in `contracts/src/BaseStrategy.sol`; no setter exists anywhere in
`contracts/src/` (grep confirms). The live LDAT value is 0.005 ETH/block
(~2.6-3.6 ETH/hr max-price ceiling). Any plan that assumes tuning it
post-deploy is wrong; changing it means a new deployment. Marker:
`INV:buyincrement-immutable` at the buyIncrement declaration in
`contracts/src/BaseStrategy.sol`. Verify: `grep -rn "buyIncrement ="
contracts/src` shows only the initialize assignment. Origin: locked pre-launch
decision (2026-06); shipped docs copy once wrongly claimed the related 1.2x
multiplier was owner-adjustable and had to be corrected (commit 7184fc1) -
this register entry prevents the same drift for buyIncrement.

### 2. transfers-distributor-gated
Rule: `_afterTokenTransfer` in `contracts/src/BaseStrategy.sol` allows mint,
global/local distributors (`isDistributor`), and poolManager moves covered by
a hook-set transient allowance; every other wallet-to-wallet transfer reverts
InvalidTransfer. User transfers exist only through the whitelisted
TransferRelay (`contracts/src/LineaDATTransferRelay.sol`, live in prod since
2026-06-21, 1% fee burned, two-hop). Never remove the gate, never quietly
un-whitelist the relay, and user-facing docs must keep disclosing the
whitelist. Marker: `INV:transfers-distributor-gated` at _afterTokenTransfer.
Verify: forge tests in `contracts/test/ForkTransferRelay.t.sol` pass; a
direct wallet-to-wallet transfer on a fork reverts. Origin: the transfer
gate is a core tokenomics differentiator vs competitors; docs fixed
2026-07-16 to disclose it (commit 3a2b72b, "no whitelist" claim was false).

### 3. distributor-whitelist-after-swapper-redeploy
Rule: after any Strategy or Swapper redeploy, the swapper must be
re-whitelisted via Strategy.setDistributor(swapper, true) or every sell
reverts under [inv: transfers-distributor-gated]. Moot for live LDAT (the
2026-06-04 option C decision routes trades through the standard Uniswap
UniversalRouter with no custom swapper) but mandatory for any future DAT
that ships one. Marker: `INV:distributor-whitelist-after-swapper-redeploy`
at setDistributor in `contracts/src/BaseStrategy.sol`. Verify: after a
redeploy, read isDistributor(swapper) == true before announcing. Origin:
testnet-phase feedback rule - sells reverted after a Strategy/Swapper
redeploy until the whitelist call was repeated.

### 4. fee-address-claim-after-redeploy
Rule: every proxy redeploy must be followed by
hook.adminUpdateFeeAddress(proxy, creator) (factory-owner gated in
`contracts/src/LineaDATHook.sol`); without it ownerAmount silently merges
into treasury and the fee split degrades from 80/20 to 90/10. The deploy
script performs this as step 6b, per `docs/50-lineadat-spec.md` section 3.
Marker: `INV:fee-address-claim-after-redeploy` at the step 6b
adminUpdateFeeAddress call in `contracts/script/Deploy.s.sol`. Verify: the
deploy log prints the "[6b] feeAddressClaimedByOwner[proxy]" line and an
on-chain read of the hook fee address for the proxy returns the creator.
Origin: recurring Phase 3 redeploy footgun - the merge is silent, nothing
reverts, the creator share just disappears into treasury.

### 5. exact-input-on-etherex (external)
Rule: the Etherex CL router (Ramses-v3 fork, Linea's deepest LINEA/WETH
pool) answers exact-output QUOTES but REVERTS every exact-output swap; the
keeper therefore quotes exact-out to size the trade, then executes
exactInputSingle. External: keeper repo (lineadat-keeper on Fly), file
src/index.ts, comment at the buy-side swap. No in-repo marker. Verify:
keeper /status shows completed buy rounds; any patch reintroducing
exactOutputSingle as an executed swap is wrong by construction. Origin:
launch day 2026-06-09 - every exact-output swap reverted until the keeper
was switched to exact-in, after which it bought mainnet bag #1 autonomously.

### 6. single-keeper-instance (external)
Rule: the Fly app lineadat-keeper runs exactly one machine, ever. A second
instance shares the keeper EOA, races nonces, and can double-send buy/sell
txs. Horizontal scaling applies only to the indexer/frontend, never the
keeper. External: Fly config of the keeper app. No in-repo marker. Verify:
`fly machines list -a lineadat-keeper` shows one machine. Origin: standing
ops rule since mainnet launch 2026-06-09; the keeper holds signing keys and
its loop assumes it is the only writer.

### 7. valuations-use-list-price
Rule: aggregate treasury/holdings USD figures are computed as currentFees
plus the sum of live onSale list prices (each bag listed at cost x 1.2, i.e.
what the DAT will actually collect), never as DEX spot value of the held
tokens. useHoldingsTotals in `frontend/src/components/holdings-table.tsx`
computes totalListed from live onSale reads; `frontend/src/components/fundings-card.tsx`
and `frontend/src/components/dats-explorer.tsx` build their USD totals from
it. Marker: `INV:valuations-use-list-price` at useHoldingsTotals. Verify:
totalUsd in fundings-card equals (currentFees + totalListed) * ETH price;
no component multiplies bag token amounts by DEX spot. Origin: data-honesty
decision - list price is the contract-enforced exit value; quoting spot
would overstate or understate the treasury depending on pool drift.

### 8. burn-reads-dead-balance
Rule: burned supply = token.balanceOf(0x...dEaD), read on-chain by the
snapshot route (`frontend/src/app/api/snapshot/route.ts`, DEAD const) and
displayed by `frontend/src/components/burned-card.tsx` as a share of
totalSupply. _buyAndBurnTokens in `contracts/src/BaseStrategy.sol` sends
swap output to DEAD_ADDRESS without reducing totalSupply, so any
"MAX_SUPPLY minus totalSupply" computation reads 0 forever and would render
the burn card permanently at 0%. Marker: `INV:burn-reads-dead-balance` at
the DEAD const in the snapshot route. Verify: /api/snapshot `burned` equals
an on-chain balanceOf(DEAD) read. Origin: contract design - burn is a
transfer to the dead address, not an ERC20 burn; the metric must follow the
mechanism.

### 9. pool-id-derived-at-runtime
Rule: POOL_ID = keccak256(abi.encode(PoolKey)) and POOL_SLOT0 =
keccak256(abi.encode(POOL_ID, 6)) are computed at runtime in
`frontend/src/lib/abis/poolmanager.ts` from POOL_KEY (defined in
`frontend/src/lib/wagmi.ts`), so a contract redeploy that changes
strategy/hook addresses auto-updates the pool id. Never hardcode either
value. Marker: `INV:pool-id-derived-at-runtime` at POOL_KEY in
`frontend/src/lib/wagmi.ts` (the abis directory is excluded from the marker
grep, so the marker sits at the input constant, not the derivation).
Verify: after any pool redeploy the slot0 price matches the indexer's
reported price. Origin: a previously hardcoded id kept reading a stale
zombie pool, so the live slot0 read disagreed with the indexer and broke
the 24h change widget (comment history in the file).

### 10. rpc-failover-infura-first
Rule: every frontend RPC client is built on the shared viem `fallback()`
transport from `frontend/src/lib/rpc.ts`: env-provided URLs Infura-first,
with the public pool (drpc, publicnode, 1rpc) always appended; failover is
per-request and reverts to Infura automatically on recovery. Never
instantiate a raw single-URL http transport. Env: LINEA_RPC_URLS /
NEXT_PUBLIC_LINEA_RPC_URLS (names only). Marker:
`INV:rpc-failover-infura-first` at buildTransport. Verify: `grep -rn
"http(" frontend/src` resolves only inside rpc.ts plus the legacy Base
Sepolia branches (the testnet transport in `frontend/src/lib/wagmi-client.ts`
and the non-Linea fallback in `frontend/src/app/status/page.tsx`); every
Linea-mainnet client uses lineaClientTransport. Origin: 2026-06-13 full
Infura Linea outage - the old single-RPC setup took the whole site to $0
until the fallback transport shipped the same day (mirrored in the indexer
and keeper).

### 11. rpc-cost-not-per-visitor
Rule: on-chain state shared by all visitors is read once server-side by the
CDN-cached snapshot route (`frontend/src/app/api/snapshot/route.ts`) and
event tables are indexer-only; the browser getLogs fallback
(getEventsChunked) was removed for good and per-browser multicalls of
shared state must not return. Per-wallet reads (balances/allowance) stay
client-side. When the indexer is down, tables say "temporarily unavailable"
honestly instead of hammering the RPC. Marker:
`INV:rpc-cost-not-per-visitor` at the header note in
`frontend/src/lib/utils.ts`. Verify: `grep -rn "getLogs" frontend/src`
matches only comments. Origin: obsidian incidents log INC-1 - on launch day
2026-06-09 the per-tab getLogs fallback burned 9.4M Infura credits (82% of
the daily quota) in about an hour; the quota is account-wide, so the
frontend storm also starved the keeper.

### 12. same-origin-proxies
Rule: the browser reaches the Ponder indexer and the keeper status
exclusively through the same-origin proxies
`frontend/src/app/api/indexer/route.ts` and
`frontend/src/app/api/keeper-status/route.ts` (runtime nodejs, not edge);
INDEXER_URL in `frontend/src/lib/indexer.ts` is "/api/indexer" and the real
Fly URL lives only server-side (INDEXER_URL env, legacy
NEXT_PUBLIC_INDEXER_URL fallback). fly.dev is unreachable
from sanctioned regions, so the proxies are load-bearing and must survive
every refactor. Marker: `INV:same-origin-proxies` at INDEXER_URL. Verify:
`grep -rn "fly.dev" frontend/src` outside the api routes yields comments
only; a POST to https://www.on-chaindat.com/api/indexer returns GraphQL
data. Origin: obsidian incidents log INC-2 - users in Belarus saw empty
swaps/holdings/sales tables because the browser called fly.dev directly;
the getLogs fallback had masked the hole until INC-1 removed it.

### 13. vercel-env-overrides
Rule: the ADDR map in `frontend/src/lib/wagmi.ts` resolves
NEXT_PUBLIC_*_ADDRESS envs first and falls back to checked-in constants;
the fallbacks are historical (FALLBACK_STRATEGY is a dead pre-launch
address, the live proxy differs), so prod correctness depends on the Vercel
envs. After every redeploy verify them, and set values only via the Vercel
REST API: the CLI `vercel env add` stores EMPTY values. Marker:
`INV:vercel-env-overrides` at ADDR. Verify: list the project envs via REST
and diff against the intended live addresses; the site must show the live
strategy address. Origin: obsidian incidents log INC-4 (CLI writes empty
values) plus the standing post-redeploy check that caught env drift
overriding wagmi fallbacks.

### 14. indexer-fresh-pglite-dir
Rule: before every indexer code redeploy, bump PONDER_DATABASE_DIRECTORY
(read in the database block of `automation/indexer/ponder.config.ts`) to a
fresh path under /data, or Ponder crash-loops with MigrationError ("Schema
public was previously used by a different Ponder app"). The post-deploy
resync from START_BLOCK burns RPC quota proportional to chain history, so
schedule it in a low-load window; prune dead pglite dirs afterwards (they
caused the 2026-07-12 ENOSPC crash-loop). Marker:
`INV:indexer-fresh-pglite-dir` at the database block (convention). Verify:
after deploy the machine logs show a clean backfill, no MigrationError.
Origin: obsidian incidents log INC-7 plus the 2026-07-12 disk exhaustion
incident (volume extended 1->3GB, dead dirs removed).

### 15. chart-corrupt-tick-defense
Rule: the price chart applies two independent defenses from
`frontend/src/lib/chart-scale.ts`: inPriceBand drops ticks outside a sanity
band anchored on the live pool price (multi-order-of-magnitude junk from a
bad sqrtPriceX96), and robustPriceRange frames the y-axis on a percentile
band clamped to a non-negative floor so a tick that slips through cannot
invert or blow out the scale. `frontend/src/components/price-chart.tsx`
consumes both; neither may be bypassed. Marker:
`INV:chart-corrupt-tick-defense` at inPriceBand/robustPriceRange. Verify:
feed a 1000x spike tick through robustPriceRange and confirm the returned
range ignores it and never goes negative. Origin: commit 3e1a480
(2026-06-03, pre-launch) - a single anomalous swap tick (at-init /
low-liquidity / stale sqrtPriceX96, observed ~0.06 ETH/token vs the real
~2.5e-8) blew out lightweight-charts' default autoscale: the y-axis ran
negative and the real series collapsed to a flat line at zero.

### 16. tx-busy-guard
Rule: any button that submits a transaction stays disabled through the full
lifecycle: wallet signing (isPending from useWriteContract) OR receipt wait
(isConfirming from useWaitForTransactionReceipt), composed as txBusy in
`frontend/src/components/actions-card.tsx` and mirrored in
`frontend/src/components/holdings-table.tsx`; the swap flow's modal
(`frontend/src/components/swap-progress-modal.tsx`) applies the same idea
via step-based disabling. isPending alone re-enables the button 3-5s before
the tx mines and invites double-submits. Marker: `INV:tx-busy-guard` at the
txBusy const in actions-card. Verify: grep every useWriteContract call site
and confirm its trigger disables on a condition that includes the receipt
wait. Origin: hash-returned-but-unmined window observed during testnet
stress runs; a second click in that window sends a duplicate tx.

### 17. snapshot-live-data-validation
Rule: uptime checks must assert semantically meaningful values, not
envelope shape: the monitor's snap_live requires http 200, the
availableFunds key, blockNumber > 0 AND a non-zero sqrtPriceX96 before
calling /api/snapshot healthy. Any new health probe follows the same
pattern. Marker: `INV:snapshot-live-data-validation` at snap_live in
`.github/scripts/monitor.py`. Verify: simulate an all-zeros snapshot
payload and confirm the Telegram status alert fires. Origin: during the
2026-06-13 Infura outage the route returned a structurally-valid all-zeros
payload, the old presence-only check stayed green, and the status channel
never alerted while the site showed $0.

### 18. theme-lock-responsive-matrix
Rule: the frontend is locked to the single cyberpunk theme defined in
`frontend/src/app/globals.css`; no alternative themes, no light mode. Every
UI change is verified at 320/375/768/1024/1440 px (historically via the
dedicated UI-tester subagent) before shipping. Marker:
`INV:theme-lock-responsive-matrix` at the top of globals.css (convention).
Verify: screenshot pass at the five widths shows no horizontal overflow and
no theme drift. Origin: Phase 3 decision locking the theme after repeated
restyling churn; the five-width matrix caught overflow regressions (e.g.
terms page at 320px) that single-width checks missed.

### 19. docs-subdomain-308-not-rewrite
Rule: docs.on-chaindat.com is a branded alias that 308-redirects to
www.on-chaindat.com/docs/* via `frontend/src/middleware.ts` (stray /docs
prefixes converge on one target). Never switch back to a rewrite: the
rewrite served byte-identical pages on two hosts, and Next resolved the
relative canonical against the request path, so the subdomain advertised a
404 canonical. The 308 also lets the docs tree prerender statically.
Marker: `INV:docs-subdomain-308-not-rewrite` at SUBDOMAIN_PREFIXES. Verify:
`curl -I https://docs.on-chaindat.com/ldat` returns 308 with location
https://www.on-chaindat.com/docs/ldat. Origin: 2026-07 SEO audit (see
`docs/90-seo-roadmap.md`) - the duplicate-host clone was one of the W0-W5
fixes and must not regress.

### 20. indexnow-key-immutable
Rule: the IndexNow key is permanent: the KEY const in
`.github/scripts/indexnow.mjs` and its public validation file
`frontend/public/8152797bdb756f9c95f5ad2505b1a19b.txt` must never be
regenerated or renamed; the workflow `.github/workflows/indexnow.yml` pings
Bing/Yandex with it on every content push. A new key resets Bing's
established trust in the submitted URL set. Marker:
`INV:indexnow-key-immutable` at the KEY const. Verify: the key file URL on
prod serves exactly the KEY value; workflow runs report 200. Origin: Bing
Webmaster integration 2026-07-16 - the key was validated once and the setup
notes flag regeneration as the one destructive action.

### 21. no-em-dash
Rule: no em dash (U+2014) or en dash (U+2013) anywhere in the repo or in
any agent-produced output - prose, UI text, code, comments, commits; plain
hyphen only. Marker: `INV:no-em-dash` at the DASHES check in
`scripts/docs-lint.mjs` (lint added 2026-07-17, pending first commit; the
marker grep sees it once tracked). Verify: `node scripts/docs-lint.mjs`
exits 0; its byte-level scan flags any offending line. Origin: global
typography rule (standing user directive), enforced mechanically for the
canon docs because dashes kept re-entering via generated copy.

### 22. repo-english-only
Rule: all repo content is strictly English: docs, code comments, specs,
commit messages, UI copy. Russian exists only in chat and local agent
config, never in repo files; episodic Russian sources are translated, not
quoted. Marker: `INV:repo-english-only` at the CYRIL check in
`scripts/docs-lint.mjs` (same pending-commit note as [inv: no-em-dash]).
Verify: `node scripts/docs-lint.mjs` exits 0; its Cyrillic scan flags any
offending line. Origin: 2026-06-30 sweep - Russian text was flagged across
the repo and 13 docs were translated; the rule has been enforced since.
