# Deploy and infra

Purpose: how code and configuration reach production across the three
surfaces this project runs on - the Vercel project serving
www.on-chaindat.com, the three-app Fly.io fleet, and the Infura account
metering every RPC read - plus the domain set fronting them. Read
`docs/ARCHITECTURE.md` first for the four planes and the repo/deployment
boundaries; this doc covers the Vercel mechanics, the domain/DNS layout,
the Fly inventory, and the Infura keys.

## How it works

1. **Vercel project lineadat (team patronnys-projects), root directory
   frontend/, git-connected.** Every push to main is a production deploy.
   There is NO vercel.json: settings (root directory, envs, domains)
   live only in the dashboard, linked locally via the gitignored
   .vercel/ dir at repo root. Manual deploys are npx vercel --prod --yes
   from REPO ROOT, never inside frontend/ - the root directory is
   already frontend/, so it double-resolves to frontend/frontend/.
2. **API access rides the claude-ops token**: a no-expiration Vercel
   token stored as VERCEL_TOKEN in the gitignored root .env (short-lived
   CLI tokens kept expiring mid-incident). All env WRITES go through the
   Vercel REST API, never `vercel env add` - the CLI stores EMPTY values
   [inv: vercel-env-overrides]. NEXT_PUBLIC_* values bake into the
   bundle at build time: changing one needs a redeploy, and open tabs
   keep the old value until the credential itself is revoked (that is
   how the INC-1 storm was cut: old Infura key deleted, stale tabs 401).
3. **RPC env pair** [inv: rpc-failover-infura-first]. LINEA_RPC_URLS is
   the server-side comma list read first by `frontend/src/lib/rpc.ts`
   (Infura ops key, then drpc / publicnode / 1rpc);
   NEXT_PUBLIC_LINEA_RPC_URLS is the browser list, public-pool-only
   since the 2026-06-14 cleanup - no paid key ships in the bundle, since
   heavy shared reads sit server-side on the CDN-cached snapshot route
   [inv: rpc-cost-not-per-visitor]. Legacy single-URL envs
   (LINEA_RPC_URL_SERVER, NEXT_PUBLIC_LINEA_RPC_URL) linger, ignored
   while the *_URLS lists are set.
4. **Domains.** www.on-chaindat.com is canonical. The apex 307-redirects
   to www (a Vercel dashboard domain setting, default status).
   docs.on-chaindat.com 308-redirects via `frontend/src/middleware.ts`
   [inv: docs-subdomain-308-not-rewrite]. lineastr.vercel.app, the
   legacy alias, 308-redirects to www path-preserved via the Vercel
   domain API (the redirect field takes a bare domain name already on
   the project); before SEO fix W1.4 (`docs/90-seo-roadmap.md`) it
   served a fully indexable 200 clone. DNS is plain GoDaddy: apex A
   record, www CNAME cname.vercel-dns.com.
5. **Fly fleet - one machine each, region fra, secrets via fly secrets
   set, never in git.** lineadat-indexer: Ponder indexer + GraphQL on a
   3 GB volume; deploy with -c `automation/indexer/fly.linea.toml` after
   bumping the pglite dir [inv: indexer-fresh-pglite-dir] (the bare
   `automation/indexer/fly.toml` targets the dead testnet app).
   lineadat-keeper: the buy/sell/twap loop from the external private
   repo at ~/Desktop/lineadat-keeper; exactly one machine, ever
   [inv: single-keeper-instance]. lineadat-monitor: always-on worker (no
   inbound service) running `.github/scripts/monitor.py` in MONITOR_LOOP
   mode every 60s; deploy is fly deploy . --config
   `automation/monitor/fly.toml` FROM REPO ROOT - the
   `automation/monitor/Dockerfile` COPYs the shared script out of
   .github/scripts/, so the build context must be the repo root.
6. **The same-origin proxies are permanent infrastructure**
   [inv: same-origin-proxies]. `frontend/src/app/api/indexer/route.ts`
   and `frontend/src/app/api/keeper-status/route.ts` are the only
   browser path to Fly (fly.dev is unreachable from sanctioned regions);
   upstreams come from server-side envs (INDEXER_URL / KEEPER_STATUS_URL,
   NEXT_PUBLIC_ fallbacks). Never remove them in a cleanup.
7. **Infura account structure.** The production account lives on
   app.infura.io (classic dashboard), GitHub social login, email
   patron4eg@gmail.com - NOT developer.metamask.io. Launch design was
   five segregated keys (keeper / frontend / indexer / ops / deploy) so
   no consumer can starve another's request path, but the ~15M
   credits/day QUOTA is account-wide: the INC-1 getLogs storm burned 82%
   of it from browsers alone and starved the keeper. Three keys remain
   in use - INFURA_OPS (server snapshot + contract deploys),
   INFURA_KEEPER, INFURA_INDEXER, names in the root .env; the deploy key
   died in the 2026-06-14 cleanup and the rotated frontend key's
   successor is unreferenced (browsers run on the public pool). Origin
   allowlists on any browser-facing key must list both site origins; a
   new domain 403s silently until added. Credit-limit
   emails are ON, bridged to Telegram.
8. **Generated vs tracked.** This subsystem tracks only config; the live
   state - Vercel settings/envs/domains, Fly machines and secrets,
   Infura keys - is dashboard/API state, deliberately not in git.
   Gitignored but critical: root .env (VERCEL_TOKEN, INFURA_*, TG_*, the
   LINEADAT_* address book), .vercel/, obsidian/ (the keeper's code is
   off-repo at ~/Desktop/lineadat-keeper; the gitignore's
   automation/keeper/ entry is a legacy path, no longer present).

## Owns

`frontend/src/middleware.ts`, `frontend/next.config.mjs`,
`automation/monitor/fly.toml`, `automation/monitor/Dockerfile`, plus the
off-repo surfaces: the Vercel project, Fly machine/secret state, DNS at
GoDaddy, and the Infura account. The indexer's Fly configs belong to
`docs/subsystems/indexer.md`; the keeper's to `docs/subsystems/keeper.md`.

## Local invariants

Owns the operating procedure for [inv: vercel-env-overrides] (anchored
at the ADDR export in `frontend/src/lib/wagmi.ts`) and
[inv: docs-subdomain-308-not-rewrite] (anchored at SUBDOMAIN_PREFIXES in
`frontend/src/middleware.ts`). Reads [inv: same-origin-proxies],
[inv: rpc-failover-infura-first], [inv: rpc-cost-not-per-visitor],
[inv: indexer-fresh-pglite-dir], [inv: single-keeper-instance], and
[inv: indexnow-key-immutable].

## Verify

- REST env list (api.vercel.com/v9/projects/<id>/env?teamId=<team>,
  $VERCEL_TOKEN): NEXT_PUBLIC_*_ADDRESS values must match the live
  address table in `docs/ARCHITECTURE.md`.
- curl -sI https://docs.on-chaindat.com/ldat gives 308 to
  https://www.on-chaindat.com/docs/ldat; https://lineastr.vercel.app/docs/ldat
  gives 308 path-preserved; the apex gives 307 to www.
- fly machines list -a lineadat-indexer / lineadat-keeper /
  lineadat-monitor: exactly one machine each, state started.
- After a push to main, npx vercel ls (repo root) shows a READY deploy.
- Infura dashboard daily usage around 3M credits (~20% of quota); a
  sudden multiple is INC-1 shaped.

## Gotchas

- The root .env once held TWO VERCEL_TOKEN lines and grep -m1 picked the
  dead one; keep it a single line.
- transfer.on-chaindat.com is attached to the Vercel project with NO DNS
  record - dangling config. If DNS is ever pointed at it,
  `frontend/src/middleware.ts` has no transfer. prefix, so it would
  serve the site as a third duplicate host; add a redirect first.
- The apex 307 and the vercel.app 308 live in Vercel domain state, not
  the repo; moving the domain to a new project silently drops both.
- Key segregation isolates attribution, not budget: the account-wide
  quota means a client storm starves the keeper [inv: rpc-cost-not-per-visitor].

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- feedback_vercel_env_overrides.md - project/team ids, the claude-ops
  token, and the env-override incident behind the post-redeploy check.
- project_launch_temp_hacks.md - the launch-day key rotation and the
  permanence ruling on the same-origin proxies.
- project_rpc_resilience.md - the *_URLS env design and the 2026-06-14
  key cleanup (which keys live, which died).
- reference_infura_account.md - the Infura account location and login.
- project_ops_monitor.md - the lineadat-monitor worker's checks.
