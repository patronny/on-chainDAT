# Monitoring and ops

Purpose: tell whether the live LDAT system is healthy - site, snapshot,
keeper, indexer, RPC chain - page Telegram the moment it is not, and push
the good news (bags bought and sold, burns, every user trade) to the same
channels. Read `docs/ARCHITECTURE.md` first for the four planes; this doc
covers the one component watching all of them, `.github/scripts/monitor.py`
as the always-on Fly worker lineadat-monitor, plus its single autonomous
actuator, the indexer disk self-guard.

## How it works

1. **One script, two run modes; Fly is primary.** `.github/scripts/monitor.py`
   (stdlib-only Python) is the single source of truth. With MONITOR_LOOP=true
   it enters run_forever(): in-memory state, a full check pass every
   MONITOR_INTERVAL_S (60s). That mode is the Fly worker lineadat-monitor
   (region fra, ONE 256MB machine, no inbound http_service, restart policy
   always), built by `automation/monitor/Dockerfile` with the REPO ROOT as
   build context so it can COPY the script (fly deploy . --config
   automation/monitor/fly.toml). Without MONITOR_LOOP it runs one-shot via
   file state (state/monitor-state.json) - the GitHub Actions path.
2. **The GitHub cron is DISABLED; the workflow is a manual backup.** GitHub
   throttled the */5 schedule to ~hourly - useless against a 12s RPC
   failover - so on 2026-06-13 the schedule block in
   `.github/workflows/monitor.yml` was commented out and the Fly worker
   took over. workflow_dispatch stays for one-shot runs (input ping=true
   sends a deploy-confirmation via the status bot and each DAT bot; the
   trades bot sends no ping); cross-run state rides actions/cache. Never re-enable the schedule while the Fly worker
   lives: two separate state stores double-alert.
3. **Three Telegram channels, one chat (TG_CHAT_ID).** Platform checks
   (site HTTP, snapshot) -> the status bot (TG_TOKEN_STATUS); per-DAT
   checks -> that DAT's own bot (TG_TOKEN_LINEADAT); all user swaps -> the
   shared trades bot (TG_TOKEN_TRADES) as silent HTML digests. Adding a
   future DAT = one entry in the DATS list plus one TG_TOKEN_* secret.
4. **Red alerts are deduped, not spammed.** The Alerter fires once, stays
   silent for REALERT_MIN (30 min) while the condition holds, re-fires, and
   sends a green recovery note on clear. Classes: site not HTTP 200;
   snapshot not LIVE (blockNumber > 0 AND non-zero sqrtPriceX96 required
   [inv: snapshot-live-data-validation] - the 2026-06-13 Infura outage
   served an all-zeros 200 the old presence-only check passed while the
   site showed $0); keeper unreachable or alive=false; lastError debounced
   to >=2 consecutive polls (~2 min), since the keeper clears a one-tick
   RPC blip ~6s later and first-sight alerting flapped a red/green pair in
   a minute (benign signature: "missing revert data" on the aggregate3
   snapshot eth_call); keeper staleness (updatedAt > KEEPER_STALE_S 240s);
   indexer healthz not 200. Keeper balance is the one EXCEPTION - it is
   edge-triggered, not deduped (see point 6): the owner drained the keeper
   deliberately and asked to hear only on a CHANGE, so a still-low balance
   never re-nags.
5. **RPC failover tracking rides the keeper's own /status rpc field**
   [inv: rpc-failover-infura-first]. On a HOST change the monitor sends:
   off paid Infura -> "failed over to public RPC" warning, back onto
   Infura -> green, public-to-public hop -> warning.
6. **Good news + owner-actionable classes.** New bag (keeper lastBagId grew),
   bag sold (ethToTwapEth grew - ETH now awaiting burn), burn (burned delta
   from the CDN snapshot, which reads the DEAD balance per
   [inv: burn-reads-dead-balance]), and the trades digest: new swaps since
   a timestamp high-water mark via the indexer GraphQL endpoint (the first
   run only baselines the mark; block-atomic Ponder indexing plus distinct
   Linea block timestamps mean timestamp_gt cannot split a block). Digest
   ETH/USD: DefiLlama, same keyless source as `frontend/src/hooks/useEthPrice.ts`.
   Two owner-requested keeper classes live here too (both edge-triggered, not
   deduped; helpers keeper_balance_msg / arb_opportunity_msg):
   - **Keeper balance change** - one note when keeperEth crosses below
     KEEPER_ETH_MIN (0.3), one on recovery, and a silent baseline on the
     first poll after a (re)start; never a repeat while it stays low.
     keeperEth is read through parse_eth so a missing field (keeper warmup
     payload) or "?" (keeper error branch) is treated as unknown and skipped,
     not as a phantom 0.0 that would false-fire the low-balance edge.
   - **Arbitrage pre-alert** - the keeper fires a BUY when buyEdgeEth >= 0,
     so `needed = availableFundsEth - buyEdgeEth` is the exact ETH the keeper
     must hold to buy one 150k-LINEA bag, and readiness = availableFunds /
     needed. Two escalating stages, each paged ONCE per window with the
     top-up gap for the hot keeper EOA: APPROACHING at readiness >=
     ARB_READY_PCT (90%, the owner's "10% before the window") and LIVE when
     buyEdgeEth >= 0 (readiness >= 100%, the keeper's real fire point). A
     highest-stage-paged latch resets only after readiness falls back below
     ARB_REARM_PCT (80%) - window closed - and a stage must hold
     ARB_READY_STREAK (2) consecutive polls before it pages, so a jittery or
     one-off Etherex quote never spams. The owner drained the keeper on
     purpose, so no BUY resets availableFunds and readiness only climbs;
     escalating from APPROACHING to LIVE re-notifies at the moment the window
     actually opens (a single 90% alert would otherwise go silent forever as
     it widens). No periodic reminder while LIVE-and-unfunded, by design
     (owner asked not to be spammed); revisit if a slow "still open" nudge is
     wanted.
7. **The monitor spends ZERO Infura credits.** Every probe is a free
   endpoint: Fly /status, indexer healthz/graphql, the CDN-cached
   /api/snapshot, site HTML, DefiLlama. Corollary of launch-day incident
   INC-1 (the browser eth_getLogs fallback burned 82% of the daily Infura
   quota in ~1h): that fallback was first neutralized by an in-code
   kill-switch const, then DELETED for good - tables are indexer-only
   [inv: rpc-cost-not-per-visitor], see the header note in
   `frontend/src/lib/utils.ts`. No kill-switch env is left to flip.
8. **Indexer disk self-guard - the only actuator.** Origin: the 2026-07-12
   ENOSPC crash-loop (PGlite /data at 100%, WAL segment creation aborted,
   Fly restart-loop, healthz timeouts). A clean restart checkpoints the
   WAL and reclaims space (observed 736MB->164MB), so the guard measures
   /data every ~300s via a Fly Machines API df exec (machine id looked up
   dynamically, surviving recreation): >=70% used warns, >=85%
   auto-restarts the indexer with a 30 min cooldown. If the
   disk is still critical a full cooldown after a restart, a diskManual
   latch STOPS restarting and pages a human to extend the volume (real
   data growth, not WAL bloat). Each measure prints a liveness line (a
   dead guard stays visible in fly logs). Requires FLY_API_TOKEN (no-op
   when unset - the GitHub path is safe); it restarts only the indexer
   app, never the keeper [inv: single-keeper-instance].
9. **Secrets - names only, three homes.** TG_CHAT_ID, TG_TOKEN_STATUS,
   TG_TOKEN_LINEADAT, TG_TOKEN_TRADES must hold identical values in the repo
   .env (gitignored), in GitHub Actions secrets (manual dispatch), and as
   Fly secrets on lineadat-monitor. FLY_API_TOKEN exists ONLY as a Fly
   secret on the monitor app - an app-scoped macaroon attenuated down to
   lineadat-indexer alone (verified unauthorized against the keeper app).

## Owns

`.github/scripts/monitor.py`, `.github/workflows/monitor.yml`,
`automation/monitor/Dockerfile`, `automation/monitor/fly.toml`. Incident
playbook: obsidian/INCIDENTS.md (gitignored, local).

## Local invariants

Owns [inv: snapshot-live-data-validation] - implemented by the snap_live
check in `.github/scripts/monitor.py` (the INV marker comment is not yet
placed in the code; register markers are pending repo-wide). Reads [inv: rpc-failover-infura-first],
[inv: burn-reads-dead-balance], [inv: single-keeper-instance],
[inv: rpc-cost-not-per-visitor].

## Verify

- fly logs -a lineadat-monitor: "monitor run complete; alerts state: all
  green" every ~60s, plus an "indexer /data N% used" line every ~5 min.
- fly machines list -a lineadat-monitor: exactly one machine.
- fly secrets list -a lineadat-monitor: the five names from point 9.
- gh workflow run monitor.yml -f ping=true: a test message must arrive
  from the status bot and the LineaDAT bot (the trades bot sends no ping).
- After editing: python3 -m py_compile .github/scripts/monitor.py,
  redeploy from repo root, watch for the startup message on Status.

## Gotchas

- The secrets example comment in `automation/monitor/fly.toml` says
  TG_TOKEN_LDAT - stale; the code reads TG_TOKEN_LINEADAT. If that exact
  name is missing, every pass raises KeyError at the per-DAT stage: the
  Fly loop survives (run_forever logs "monitor iteration error") but all
  keeper/indexer/bag/burn/trades monitoring silently stops, and a GitHub
  one-shot run fails outright. Only a missing TG_CHAT_ID (read at import)
  actually crash-loops the machine.
- A Fly redeploy resets in-memory state: baselines (trades mark, burned,
  ethToTwap, lastBagId, keeperLow, arb window) re-init silently, so events
  during the deploy window are swallowed, and a still-broken condition
  re-pages once. The drained-keeper low balance is deliberately in this set:
  the keeperLow baseline means a redeploy stays silent about it, exactly as
  the owner asked; a genuinely open arb window re-pages ~2 min after a
  redeploy (2-poll debounce), which is wanted.
- ca-certificates in the Docker image is mandatory: without it urllib fails
  TLS on every probe and the monitor spams false full-outage alerts.
- The monitor probes fly.dev hosts directly, NOT the same-origin proxies:
  [inv: same-origin-proxies] is a browser rule, and the monitor must see
  the same upstreams the proxies wrap.
- run_forever() wraps each pass in try/except - one bad iteration never
  kills the loop; the KeyboardInterrupt during a rolling redeploy is the
  old machine's expected SIGINT, not a crash.
- Keep exactly one monitor machine (deploy with --ha=false): two loops
  hold separate state, duplicating alerts and racing disk-guard restarts.

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- project_ops_monitor.md - build history, the keeper-error debounce, the
  macaroon attenuation recipe that minted the app-scoped FLY_API_TOKEN.
- project_rpc_resilience.md - the 2026-06-13 Infura Linea outage behind
  the snapshot-live check and the failover alerts.
- project_phase3_indexer.md - the ENOSPC crash-loop the disk guard now
  prevents (volume extended 1GB -> 3GB).
- project_launch_temp_hacks.md - launch-day state behind the zero-Infura
  design: getLogs removal, relaxed probes, permanent proxies.
