#!/usr/bin/env python3
"""on-chainDAT ops monitor (GitHub Actions cron).

Routing:
  - platform checks (site, /api/snapshot)        -> @onchainDAT_Status_bot  (TG_TOKEN_STATUS)
  - per-DAT checks (keeper, indexer, bag/burn)   -> that DAT's own bot      (e.g. TG_TOKEN_LINEADAT)
  - ALL user swaps, every DAT, silent digests    -> @DATs_TXS_bot           (TG_TOKEN_TRADES)

Adding a future DAT = one entry in DATS + one TG_TOKEN_* repo secret (the
trades feed bot is shared - messages are prefixed with the DAT name).

State (previous lastBagId, alert timestamps, active RPC) persists between
runs. As an always-on Fly worker (MONITOR_LOOP=true) it keeps state in memory
and polls every MONITOR_INTERVAL_S (default 60s) - this is the reliable path,
since GitHub's scheduled cron is throttled to ~hourly and misses fast RPC
failovers. As a one-shot GitHub Actions cron it persists via actions/cache on
state/monitor-state.json. Alerts re-fire at most every REALERT_MIN while a
condition stays broken; a recovery message is sent when it clears. All checks
are free endpoints (Fly /status, CDN snapshot, site HTML) - the monitor never
spends Infura credits.
"""
import json
import os
import time
import urllib.request

CHAT_ID = os.environ["TG_CHAT_ID"]
STATE_PATH = "state/monitor-state.json"
REALERT_MIN = 30
KEEPER_ETH_MIN = 0.3
KEEPER_STALE_S = 240

# Arbitrage-opportunity pre-alert. The keeper fires a BUY when buyEdge >= 0, i.e.
# availableFunds >= bagCost*(1+slippage)+gas. `needed = availableFunds - buyEdge` is
# exactly that trigger level (and the ETH the keeper must hold to front one bag), so
# readiness = availableFunds / needed says how close the window is - derived purely
# from two /status fields, no keeper constants.
#
# Two escalating, edge-triggered stages, each paged ONCE per window so the owner can
# pre-fund the hot keeper EOA (they drained it deliberately, so no BUY resets the pot
# and readiness only climbs): APPROACHING at >= READY% ("10% before"), then LIVE when
# buyEdge >= 0 (readiness >= 100%, the keeper's real fire point). Firing only on 90%
# once would go silent forever as the window opens and widens; escalating to LIVE
# re-notifies at the moment it actually opens without nagging. The latch (highest
# stage paged) resets only when readiness falls back below REARM% (window closed) -
# hysteresis - and a STREAK-poll debounce guards against a one-off anomalous quote.
ARB_READY_PCT = 90     # APPROACHING: within 10% of the buy window
ARB_REARM_PCT = 80     # window considered closed (re-arm both stages) below this
ARB_READY_STREAK = 2   # consecutive polls a stage must hold before it pages
KEEPER_EOA = "0xc31E...e87b"

# Indexer disk self-guard (needs FLY_API_TOKEN; disabled if unset). The 2026-07-12
# outage was an ENOSPC crash-loop: the PGlite /data volume filled to 100%, so Postgres
# aborted creating a WAL segment, Fly restart-looped, and healthz timed out. A clean
# restart checkpoints the WAL and reclaims space (observed 736MB->164MB), so we measure
# /data and auto-restart the indexer to reclaim BEFORE it hits 100% - self-healing.
FLY_API = "https://api.machines.dev/v1"
INDEXER_DISK_WARN_PCT = 70            # notify (visibility)
INDEXER_DISK_CRIT_PCT = 85            # auto-reclaim (restart); still ~450MB free on 3GB
INDEXER_DISK_CHECK_EVERY_S = 300      # measure every ~5 min, not every poll
INDEXER_RESTART_COOLDOWN_S = 1800     # >=30 min between auto-restarts (recover + settle)

SITE_URL = "https://www.on-chaindat.com"
SNAPSHOT_URL = "https://www.on-chaindat.com/api/snapshot"

DATS = [
    {
        "name": "LineaDAT",
        "symbol": "LINEADAT",
        "token_env": "TG_TOKEN_LINEADAT",
        "keeper": "https://lineadat-keeper.fly.dev/status",
        "indexer_healthz": "https://lineadat-indexer.fly.dev/healthz",
        "indexer_graphql": "https://lineadat-indexer.fly.dev/graphql",
        # Fly app for the indexer disk self-guard (auto-reclaim). Machine id is
        # looked up dynamically so it survives machine recreation.
        "fly_app": "lineadat-indexer",
        "explorer_tx": "https://lineascan.build/tx/",
        # CDN-cached server route with this DAT's on-chain state (burned etc.)
        "snapshot": SNAPSHOT_URL,
    },
]


def fetch(url, timeout=20):
    """Return (http_status, parsed_json_or_None). Network errors -> (0, None)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read()
            try:
                return r.status, json.loads(body)
            except Exception:
                return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None


def send(token, text, silent=False, html=False):
    payload = {"chat_id": CHAT_ID, "text": text, "disable_notification": silent}
    if html:
        payload["parse_mode"] = "HTML"
        payload["disable_web_page_preview"] = True
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        print(f"telegram send failed: {e}")


def gql(url, query, variables=None):
    """POST a GraphQL query; returns `data` dict or None."""
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read()).get("data")
    except Exception:
        return None


def eth_usd():
    """Current ETH/USD from DefiLlama (free, no key, no rate limit) - the SAME
    source the site uses (frontend/src/hooks/useEthPrice.ts). 0.0 if unavailable,
    in which case the trades feed omits the $ figure rather than show $0."""
    code, data = fetch("https://coins.llama.fi/prices/current/coingecko:ethereum")
    if code == 200 and isinstance(data, dict):
        try:
            return float(data["coins"]["coingecko:ethereum"]["price"])
        except Exception:
            return 0.0
    return 0.0


def trades_feed(dat, dstate, trades_token):
    """Silent digest of NEW user swaps since the last run -> the shared trades bot.

    First ever run initializes the high-water mark without spamming history.
    Ponder indexes block-atomically and Linea blocks have distinct timestamps,
    so `timestamp_gt` cannot split a block's swaps across runs.
    """
    url = dat.get("indexer_graphql")
    if not url or not trades_token:
        return
    last = dstate.get("tradesTs")
    if last is None:
        d = gql(url, '{ swaps(orderBy: "timestamp", orderDirection: "desc", limit: 1) { items { timestamp } } }')
        items = (d or {}).get("swaps", {}).get("items", [])
        dstate["tradesTs"] = items[0]["timestamp"] if items else 0
        return
    d = gql(
        url,
        """query($since: Int!) { swaps(where: {timestamp_gt: $since}, orderBy: "timestamp",
             orderDirection: "asc", limit: 100) {
             items { timestamp txHash trader side ethAmount tokenAmount } } }""",
        {"since": int(last)},
    )
    items = (d or {}).get("swaps", {}).get("items", [])
    if not items:
        return
    sym = dat.get("symbol", dat["name"])
    price = eth_usd()  # one fetch per digest (only when there ARE new trades)
    lines = []
    for s in items[:25]:
        emoji = "\U0001f7e2" if s["side"] == "buy" else "\U0001f534"  # green/red circle
        eth = int(s["ethAmount"]) / 1e18
        tok = int(s["tokenAmount"]) / 1e18
        usd = f" (≈ ${eth * price:,.2f})" if price > 0 else ""
        hhmm = time.strftime("%H:%M", time.gmtime(s["timestamp"]))
        who = s["trader"][:6] + "…" + s["trader"][-4:]
        link = f'<a href="{dat.get("explorer_tx","")}{s["txHash"]}">tx</a>'
        lines.append(
            f"{emoji} {s['side'].upper()} {eth:.4f} ETH{usd} ↔ {tok:,.0f} {sym} · {who} · {hhmm} UTC · {link}"
        )
    extra = f"\n… and {len(items) - 25} more" if len(items) > 25 else ""
    send(trades_token, f"<b>{dat['name']}</b>\n" + "\n".join(lines) + extra, silent=True, html=True)
    dstate["tradesTs"] = max(int(s["timestamp"]) for s in items)


def load_state():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except Exception:
        return {"alerts": {}, "dats": {}}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w") as f:
        json.dump(state, f)


class Alerter:
    """Dedup: alert -> silence REALERT_MIN -> re-alert if still broken; recovery note on clear."""

    def __init__(self, state):
        self.alerts = state.setdefault("alerts", {})
        self.now = time.time()

    def check(self, token, key, broken, text):
        prev = self.alerts.get(key)
        if broken:
            if prev is None or self.now - prev > REALERT_MIN * 60:
                send(token, f"🔴 {text}")
                self.alerts[key] = self.now
        elif prev is not None:
            send(token, f"🟢 recovered: {key}")
            del self.alerts[key]


def _fly(method, path, token, body=None, timeout=25):
    """Fly Machines API call. Returns parsed JSON ({} for empty 2xx), None on error."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{FLY_API}{path}", data=data, method=method,
        headers={"authorization": f"Bearer {token}", "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except Exception:
        return None


def fly_machine_id(app, token):
    """Id of the app's running machine (dynamic lookup survives machine recreation)."""
    ms = _fly("GET", f"/apps/{app}/machines", token)
    if not isinstance(ms, list) or not ms:
        return None
    started = [m for m in ms if m.get("state") == "started"]
    return (started or ms)[0].get("id")


def fly_disk_pct(app, machine, token, mount="/data"):
    """Used percent of `mount` via `df` exec, or None if the call/parse fails."""
    out = _fly("POST", f"/apps/{app}/machines/{machine}/exec", token,
               {"command": ["df", "-B1", mount], "timeout": 10})
    if not isinstance(out, dict) or out.get("exit_code") != 0:
        return None
    for line in (out.get("stdout") or "").splitlines():
        p = line.split()
        if len(p) >= 6 and p[5] == mount:
            try:
                return int(p[4].rstrip("%"))
            except ValueError:
                return None
    return None


def fly_restart(app, machine, token):
    """Restart the machine (checkpoints PGlite WAL -> reclaims /data). True on success."""
    return _fly("POST", f"/apps/{app}/machines/{machine}/restart", token) is not None


def indexer_disk_guard(dat, dstate, token, al):
    """Keep the indexer /data volume off 100% (prevents the ENOSPC crash-loop). Measure
    disk every ~5 min; at CRIT auto-restart to checkpoint the WAL and reclaim space. If a
    restart does NOT reclaim (real data growth, not WAL bloat), stop restarting and page a
    human to extend the volume. No-op when FLY_API_TOKEN / fly_app are unset (GitHub cron)."""
    app = dat.get("fly_app")
    fly_token = os.environ.get("FLY_API_TOKEN")
    if not (app and fly_token):
        return
    now = time.time()
    if now - float(dstate.get("diskCheckedAt", 0)) < INDEXER_DISK_CHECK_EVERY_S:
        return
    machine = fly_machine_id(app, fly_token)
    if not machine:
        return  # transient API failure; healthz check already covers a truly-down indexer
    pct = fly_disk_pct(app, machine, fly_token)
    if pct is None:
        return  # exec failed (e.g. mid-restart) - retry next cycle, don't stamp diskCheckedAt
    dstate["diskCheckedAt"] = now
    name = dat["name"]
    key = f"{name}: indexer disk"
    # Positive liveness in `fly logs`: a silent guard (stale token / API change) would
    # otherwise look identical to a healthy one until the disk actually fills.
    print(f"{name}: indexer /data {pct}% used (warn {INDEXER_DISK_WARN_PCT}/crit {INDEXER_DISK_CRIT_PCT})")

    if pct >= INDEXER_DISK_CRIT_PCT:
        if dstate.get("diskManual"):
            al.check(token, key, True, f"{name}: indexer /data {pct}% full - a prior auto-restart did NOT free space, so this is real data growth. Extend the Fly volume (`flyctl volumes extend`); a restart won't help.")
        elif now - float(dstate.get("diskRestartAt", 0)) >= INDEXER_RESTART_COOLDOWN_S:
            if float(dstate.get("diskRestartAt", 0)) > 0:
                # restarted before, waited a full cooldown, still critical -> ineffective
                dstate["diskManual"] = True
                al.check(token, key, True, f"{name}: indexer /data still {pct}% after an auto-restart - escalating; extend the Fly volume.")
            else:
                send(token, f"🟠 {name}: indexer /data {pct}% full (>{INDEXER_DISK_CRIT_PCT}%) - auto-restarting to checkpoint PGlite WAL and reclaim space.")
                ok = fly_restart(app, machine, fly_token)
                dstate["diskRestartAt"] = now
                if not ok:
                    al.check(token, key, True, f"{name}: indexer /data {pct}% and the auto-restart API call FAILED - restart it manually.")
        # else: within cooldown, a restart is already in flight -> stay quiet
    elif pct >= INDEXER_DISK_WARN_PCT:
        al.check(token, key, True, f"{name}: indexer /data {pct}% full (warn >{INDEXER_DISK_WARN_PCT}%); auto-reclaim triggers at {INDEXER_DISK_CRIT_PCT}%.")
    else:
        al.check(token, key, False, "")   # healthy -> clears any disk alert (recovery note)
        dstate["diskRestartAt"] = 0
        dstate["diskManual"] = False


def parse_eth(raw):
    """Parse a keeper /status ETH string to float, or None when the field is absent
    or non-numeric. The keeper omits balances entirely in its `{alive:false, note:
    "warming up"}` payload (status server answers before the first tick lands) and
    sets them to "?" in its error branch. Coercing a MISSING value to 0.0 (the old
    `float(k.get(...) or 0)`) reads as a real 0-ETH balance and false-fires the
    low-balance edge on every keeper restart - treat unknown as unknown and skip."""
    if raw is None or raw == "?":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def keeper_balance_msg(name, eth, dstate, threshold=KEEPER_ETH_MIN):
    """Edge-triggered keeper-balance note: one red on the down-cross, one green on
    recovery, and NEVER a repeated nag while it stays low. The owner drained the
    keeper deliberately and asked to be told only when the balance CHANGES, so the
    first observation after a (re)start just baselines silently. Returns a message
    or None; updates dstate['keeperLow']."""
    low = eth < threshold
    prev = dstate.get("keeperLow")
    dstate["keeperLow"] = low
    if prev is None or low == prev:
        return None  # baseline (owner already knows) or unchanged -> silent
    if low:
        return f"🔴 {name}: keeper balance {eth:.4f} ETH < {threshold} ETH - BUYs will stall until topped up"
    return f"🟢 {name}: keeper balance recovered to {eth:.4f} ETH (>= {threshold})"


def arb_readiness(funds, edge):
    """How close availableFunds is to the keeper's BUY trigger, plus the trigger
    level itself. needed = funds - edge = bagCost*(1+slippage)+gas (the ETH the
    keeper must hold to buy one bag); readiness = funds/needed (>=1 means buyEdge is
    already non-negative, the window is open). Returns (readiness, needed), or
    (None, None) if a field is missing or the maths is degenerate (bad quote)."""
    if funds is None or edge is None:
        return None, None
    needed = funds - edge
    if needed <= 0:  # edge >= funds is physically impossible; guard a corrupt quote
        return None, None
    return funds / needed, needed


def arb_stage(readiness, edge):
    """0 = window not near, 1 = APPROACHING (readiness >= READY%), 2 = LIVE (buyEdge
    >= 0, i.e. the keeper would fire now if funded). LIVE is keyed on edge, not a
    readiness rounding, so it lines up with the keeper's own gate exactly."""
    if edge is not None and edge >= 0:
        return 2
    if readiness >= ARB_READY_PCT / 100.0:
        return 1
    return 0


def arb_opportunity_msg(name, funds, edge, keeper_eth, dstate):
    """Pre-alert that the keeper's BUY window is opening, so the owner can pre-fund the
    hot keeper EOA before it can act. Two escalating stages (APPROACHING, LIVE), each
    paged once, with a consecutive-poll debounce and a highest-stage-paged latch that
    re-arms only after the window closes (readiness < REARM%). Returns a message or
    None; updates dstate['arbStageSeen'], ['arbStageStreak'], ['arbStagePaged']."""
    readiness, needed = arb_readiness(funds, edge)
    if readiness is None:
        return None  # missing/degenerate quote - leave stage tracking untouched
    stage = arb_stage(readiness, edge)

    # Debounce: a stage must persist ARB_READY_STREAK consecutive polls before it pages,
    # so a single anomalous Etherex quote never fires. Streak resets on any stage change.
    if stage == dstate.get("arbStageSeen"):
        streak = dstate.get("arbStageStreak", 0) + 1
    else:
        streak = 1
        dstate["arbStageSeen"] = stage
    dstate["arbStageStreak"] = streak

    # Hysteresis: only a clearly-closed window (or a BUY, which drives readiness to ~0)
    # re-arms the stages. Without this the latch would let a jittery readiness re-page.
    if readiness < ARB_REARM_PCT / 100.0:
        dstate["arbStagePaged"] = 0

    if stage == 0 or streak < ARB_READY_STREAK:
        return None
    if stage <= dstate.get("arbStagePaged", 0):
        return None  # this stage (or a higher one) already paged this window
    dstate["arbStagePaged"] = stage

    keth = keeper_eth or 0.0
    gap = max(0.0, needed - keth)
    head = (
        f"🟡 {name}: arbitrage window LIVE NOW ({readiness * 100:.0f}%)"
        if stage == 2
        else f"🟡 {name}: arbitrage window {readiness * 100:.0f}% ready (opening soon)"
    )
    return (
        f"{head}. availableFunds {funds:.4f} / needed {needed:.4f} ETH. "
        f"Keeper holds {keth:.4f} ETH; top up ~{gap:.3f} ETH on {KEEPER_EOA} so it can "
        f"front the 150k-LINEA bag."
    )


def main(state=None):
    # GitHub one-shot: load+save file state. Fly loop: caller passes a persistent
    # in-memory dict, so we neither load nor save a file.
    persist = state is None
    ping = os.environ.get("PING") == "true"
    if persist:
        state = load_state()
    al = Alerter(state)
    status_token = os.environ["TG_TOKEN_STATUS"]
    trades_token = os.environ.get("TG_TOKEN_TRADES", "")

    # --- platform -> status bot ---
    site_code, _ = fetch(SITE_URL)
    al.check(status_token, "site", site_code != 200, f"on-chaindat.com site responds {site_code or 'timeout'} (not 200)")

    # Snapshot must be LIVE, not just a 200 envelope: during the 2026-06-13
    # Infura outage the route returned a structurally-valid all-ZEROS payload
    # (http 200, availableFunds key present = 0), so the old check thought it was
    # fine and the Status channel never alerted while the site showed $0. Require
    # real on-chain data (block number + a non-zero pool price).
    snap_code, snap = fetch(SNAPSHOT_URL)
    # INV:snapshot-live-data-validation assert real values, not envelope shape; see docs/INVARIANTS.md
    snap_live = (
        snap_code == 200
        and isinstance(snap, dict)
        and "availableFunds" in snap
        and int(snap.get("blockNumber") or 0) > 0
        and str(snap.get("sqrtPriceX96") or "0") not in ("0", "")
    )
    al.check(
        status_token,
        "snapshot",
        not snap_live,
        f"/api/snapshot returns empty/zero data (http {snap_code or 'timeout'}) - likely all RPCs are unavailable, the site will show $0",
    )

    if ping:
        send(status_token, "🧪 monitor deployed and running (platform channel). Checking site + snapshot every ~5 minutes.")

    # --- per-DAT -> own bot ---
    for dat in DATS:
        token = os.environ[dat["token_env"]]
        name = dat["name"]
        dstate = state.setdefault("dats", {}).setdefault(name, {})

        k_code, k = fetch(dat["keeper"])
        k_ok = k_code == 200 and isinstance(k, dict)
        al.check(token, f"{name}: keeper http", not k_ok, f"{name}: keeper /status unavailable (http {k_code or 'timeout'})")

        if k_ok:
            al.check(token, f"{name}: keeper alive", not k.get("alive"), f"{name}: keeper reports alive=false")
            # Debounce single-tick transients. The keeper sets lastError on ONE failed
            # tick and clears it on the next successful tick (~6s later); a benign RPC
            # blip (e.g. Infura returning "missing revert data" mid-eth_call on the
            # aggregate3 snapshot) self-heals without any action ever firing. Alerting on
            # the first sighting flapped a 🔴/🟢 pair inside a minute. Require the error to
            # survive >=2 consecutive polls (~2 min) before paging: a genuinely stuck
            # keeper (sustained RPC outage / wedged process) still trips it, a self-healing
            # blip stays silent. Streak persists in dstate (Fly in-memory loop + GH cache).
            err = k.get("lastError")
            streak = (dstate.get("keeperErrStreak", 0) + 1) if err else 0
            dstate["keeperErrStreak"] = streak
            al.check(token, f"{name}: keeper error", streak >= 2, f"{name}: keeper lastError: {str(err)[:160]}")

            # RPC failover / revert notifications. The keeper exposes its active
            # RPC as e.g. "linea-mainnet.infura.io (1/4)" / "linea.drpc.org (2/4)".
            # We alert on a HOST change: off paid Infura (outage), back to Infura
            # (recovery), or one public dying and the next taking over.
            rpc = str(k.get("rpc") or "").strip()
            if rpc:
                host = rpc.split(" ")[0]
                prev_rpc = dstate.get("rpc")
                prev_host = str(prev_rpc or "").split(" ")[0]
                if prev_host and host != prev_host:
                    if "infura" in host.lower():
                        send(token, f"🟢 {name}: RPC switched back to paid Infura ({rpc})")
                    elif "infura" in prev_host.lower():
                        send(token, f"⚠️ {name}: paid Infura unavailable - keeper failed over to public RPC {rpc}")
                    else:
                        send(token, f"⚠️ {name}: public RPC changed {prev_host} → {rpc} (previous one dropped)")
                dstate["rpc"] = rpc
            try:
                age = time.time() - time.mktime(time.strptime(k["updatedAt"][:19], "%Y-%m-%dT%H:%M:%S"))
                al.check(token, f"{name}: keeper stale", age > KEEPER_STALE_S, f"{name}: keeper has not updated status for {int(age)}s (>{KEEPER_STALE_S}s) - the process may be stuck")
            except Exception:
                pass
            # Keeper balance + arbitrage share a guarded keeperEth: parse_eth returns
            # None for a missing/"?" value (keeper warmup or error payload) so we never
            # read a phantom 0.0 and false-fire the balance edge.
            keth = parse_eth(k.get("keeperEth"))

            # Keeper balance: edge-triggered, not a repeated nag. The owner drained the
            # keeper on purpose (no trades = idle capital) and asked to be told only on a
            # CHANGE, so we baseline the current low state silently and speak on the next
            # down/up crossing. See keeper_balance_msg.
            try:
                if keth is not None:
                    bmsg = keeper_balance_msg(name, keth, dstate)
                    if bmsg:
                        send(token, bmsg)
            except Exception:
                pass

            # Arbitrage-opportunity pre-alert: warn ~10% before the keeper's BUY window
            # opens (then again when it goes LIVE) so the owner can re-fund the hot EOA in
            # advance. buyEdgeEth mirrors the keeper's own profit gate, so needed =
            # availableFunds - buyEdge is the exact trigger level. See arb_opportunity_msg.
            try:
                funds = parse_eth(k.get("availableFundsEth"))
                edge = parse_eth(k.get("buyEdgeEth"))
                amsg = arb_opportunity_msg(name, funds, edge, keth, dstate)
                if amsg:
                    send(token, amsg)
            except Exception:
                pass

            # good news: new bag bought
            try:
                bag = int(k.get("lastBagId") or 0)
                prev_bag = int(dstate.get("lastBagId") or 0)
                if prev_bag and bag > prev_bag:
                    send(token, f"💰 {name}: new bag #{bag} bought (was #{prev_bag}). availableFunds reset to zero, accumulating again.")
                dstate["lastBagId"] = bag
            except Exception:
                pass

            # good news: bag sold (ethToTwap grew). First run just records the baseline.
            try:
                twap = float(k.get("ethToTwapEth") or 0)
                if "ethToTwap" in dstate and twap > float(dstate["ethToTwap"]) + 1e-9:
                    gain = twap - float(dstate["ethToTwap"])
                    send(token, f"💸 {name}: bag sold - ethToTwap grew by {gain:.4f} ETH (now {twap:.4f} ETH, awaiting burn).")
                dstate["ethToTwap"] = twap
            except Exception:
                pass

        # good news: EVERY burn (balanceOf(DEAD) delta from the DAT's snapshot)
        if dat.get("snapshot"):
            s_code, s = fetch(dat["snapshot"])
            if s_code == 200 and isinstance(s, dict):
                try:
                    burned = int(s.get("burned") or 0)
                    if "burned" in dstate and burned > int(dstate["burned"]):
                        delta = (burned - int(dstate["burned"])) / 1e18
                        total = burned / 1e18
                        pct = burned / 1e27 * 100
                        send(token, f"🔥 {name}: BURN! Burned +{delta:,.0f} tokens (total {total:,.0f} = {pct:.4f}% supply).")
                    dstate["burned"] = str(burned)
                except Exception:
                    pass

        i_code, _ = fetch(dat["indexer_healthz"])
        al.check(token, f"{name}: indexer", i_code != 200, f"{name}: indexer healthz {i_code or 'timeout'} (tables on the site will stop updating)")

        # Self-guard the indexer disk so it never repeats the 2026-07-12 ENOSPC crash-loop.
        indexer_disk_guard(dat, dstate, token, al)

        trades_feed(dat, dstate, trades_token)

        if ping:
            send(token, f"🧪 monitor deployed and running ({name} channel). Watching the keeper, indexer, bags and burns every ~5 minutes.")

    if persist:
        save_state(state)
    print("monitor run complete; alerts state:", list(state.get("alerts", {}).keys()) or "all green")


def run_forever():
    """Always-on Fly mode: in-memory state, poll every MONITOR_INTERVAL_S.
    Reliable cadence (vs GitHub's ~hourly cron) so RPC failovers and recoveries
    are caught within a minute."""
    interval = int(os.environ.get("MONITOR_INTERVAL_S", "60"))
    state = {"alerts": {}, "dats": {}}
    status_token = os.environ.get("TG_TOKEN_STATUS")
    if status_token:
        send(status_token, f"🛰️ live monitor started on Fly (polling every {interval}s). Catching RPC changes, outages and recoveries in real time.")
    while True:
        try:
            main(state)
        except Exception as e:  # never let one bad iteration kill the loop
            print("monitor iteration error:", e)
        time.sleep(interval)


if __name__ == "__main__":
    if os.environ.get("MONITOR_LOOP") == "true":
        run_forever()
    else:
        main()
