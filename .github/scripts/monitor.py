#!/usr/bin/env python3
"""on-chainDAT ops monitor (GitHub Actions cron).

Routing:
  - platform checks (site, /api/snapshot)        -> @onchainDAT_Status_bot  (TG_TOKEN_STATUS)
  - per-DAT checks (keeper, indexer, bag/burn)   -> that DAT's own bot      (e.g. TG_TOKEN_LINEADAT)
  - ALL user swaps, every DAT, silent digests    -> @DATs_TXS_bot           (TG_TOKEN_TRADES)

Adding a future DAT = one entry in DATS + one TG_TOKEN_* repo secret (the
trades feed bot is shared - messages are prefixed with the DAT name).

State (previous lastBagId, alert timestamps) persists between runs via
actions/cache on state/monitor-state.json. Alerts re-fire at most every
REALERT_MIN while a condition stays broken; a recovery message is sent
when it clears. All checks are free endpoints (Fly /status, CDN snapshot,
site HTML) - the monitor never spends Infura credits.
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
    lines = []
    for s in items[:25]:
        emoji = "\U0001f7e2" if s["side"] == "buy" else "\U0001f534"  # green/red circle
        eth = int(s["ethAmount"]) / 1e18
        tok = int(s["tokenAmount"]) / 1e18
        hhmm = time.strftime("%H:%M", time.gmtime(s["timestamp"]))
        who = s["trader"][:6] + "…" + s["trader"][-4:]
        link = f'<a href="{dat.get("explorer_tx","")}{s["txHash"]}">tx</a>'
        lines.append(
            f"{emoji} {s['side'].upper()} {eth:.4f} ETH ↔ {tok:,.0f} {sym} · {who} · {hhmm} UTC · {link}"
        )
    extra = f"\n… и ещё {len(items) - 25}" if len(items) > 25 else ""
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
            send(token, f"🟢 восстановилось: {key}")
            del self.alerts[key]


def main():
    ping = os.environ.get("PING") == "true"
    state = load_state()
    al = Alerter(state)
    status_token = os.environ["TG_TOKEN_STATUS"]
    trades_token = os.environ.get("TG_TOKEN_TRADES", "")

    # --- platform -> status bot ---
    site_code, _ = fetch(SITE_URL)
    al.check(status_token, "site", site_code != 200, f"сайт on-chaindat.com отвечает {site_code or 'timeout'} (не 200)")

    snap_code, snap = fetch(SNAPSHOT_URL)
    snap_ok = snap_code == 200 and isinstance(snap, dict) and "availableFunds" in snap
    al.check(status_token, "snapshot", not snap_ok, f"/api/snapshot сломан (http {snap_code or 'timeout'})")

    if ping:
        send(status_token, "🧪 монитор задеплоен и работает (платформенный канал). Проверяю сайт + snapshot каждые ~5 минут.")

    # --- per-DAT -> own bot ---
    for dat in DATS:
        token = os.environ[dat["token_env"]]
        name = dat["name"]
        dstate = state.setdefault("dats", {}).setdefault(name, {})

        k_code, k = fetch(dat["keeper"])
        k_ok = k_code == 200 and isinstance(k, dict)
        al.check(token, f"{name}: keeper http", not k_ok, f"{name}: keeper /status недоступен (http {k_code or 'timeout'})")

        if k_ok:
            al.check(token, f"{name}: keeper alive", not k.get("alive"), f"{name}: кипер сообщает alive=false")
            err = k.get("lastError")
            al.check(token, f"{name}: keeper error", bool(err), f"{name}: кипер lastError: {str(err)[:160]}")
            try:
                age = time.time() - time.mktime(time.strptime(k["updatedAt"][:19], "%Y-%m-%dT%H:%M:%S"))
                al.check(token, f"{name}: keeper stale", age > KEEPER_STALE_S, f"{name}: кипер не обновлял статус {int(age)}с (>{KEEPER_STALE_S}с) - возможно, процесс завис")
            except Exception:
                pass
            try:
                eth = float(k.get("keeperEth") or 0)
                al.check(token, f"{name}: keeper balance", eth < KEEPER_ETH_MIN, f"{name}: баланс кипера {eth:.4f} ETH < {KEEPER_ETH_MIN} - BUY встанут, нужен долив")
            except Exception:
                pass

            # good news: new bag bought
            try:
                bag = int(k.get("lastBagId") or 0)
                prev_bag = int(dstate.get("lastBagId") or 0)
                if prev_bag and bag > prev_bag:
                    send(token, f"💰 {name}: куплен новый бэг #{bag} (было #{prev_bag}). availableFunds обнулились, копим дальше.")
                dstate["lastBagId"] = bag
            except Exception:
                pass

            # good news: bag sold (ethToTwap grew). First run just records the baseline.
            try:
                twap = float(k.get("ethToTwapEth") or 0)
                if "ethToTwap" in dstate and twap > float(dstate["ethToTwap"]) + 1e-9:
                    gain = twap - float(dstate["ethToTwap"])
                    send(token, f"💸 {name}: бэг продан - ethToTwap пополнился на {gain:.4f} ETH (теперь {twap:.4f} ETH, ждём burn).")
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
                        send(token, f"🔥 {name}: BURN! Сожжено +{delta:,.0f} токенов (всего {total:,.0f} = {pct:.4f}% supply).")
                    dstate["burned"] = str(burned)
                except Exception:
                    pass

        i_code, _ = fetch(dat["indexer_healthz"])
        al.check(token, f"{name}: indexer", i_code != 200, f"{name}: индексер healthz {i_code or 'timeout'} (таблицы на сайте перестанут обновляться)")

        trades_feed(dat, dstate, trades_token)

        if ping:
            send(token, f"🧪 монитор задеплоен и работает (канал {name}). Слежу за кипером, индексером, бэгами и burn'ами каждые ~5 минут.")

    save_state(state)
    print("monitor run complete; alerts state:", list(state.get("alerts", {}).keys()) or "all green")


if __name__ == "__main__":
    main()
