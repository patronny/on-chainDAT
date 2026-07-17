# Brand and listings

Purpose: keep one identity for the project on every external surface - site,
wallets, aggregators, the Linea Hub - and get $LDAT priced where users look.
Read `docs/ARCHITECTURE.md` first for the four planes; this doc covers what
none of them own: the naming stack, the gitignored `brand/` asset factory, the
satori-generated site icons/OG card, and the aggregator submission pipeline.

## How it works

1. **Naming stack.** Umbrella brand = on-chainDAT (on-chaindat.com, repo
   patronny/on-chainDAT). Mainnet token = LDAT/$LDAT since the on-chain
   rename tx 0x697217ac..818df of 2026-06-20 (first Keycard owner action:
   upgradeToAndCall to the V4 impl + updateNameAndSymbol, proxy address
   unchanged). WHY: Consensys delisted the app from the Linea Hub over the
   Linea-derived "LineaDAT" brand - banned in user-facing copy ("Linea L2"
   as a network descriptor is fine). Solidity identifiers keep the prefix
   (`contracts/src/LineaDATStrategy.sol` etc.) - code, not brand. The Base
   Sepolia testnet token stays LINEASTR forever (deployed contracts keep
   their symbol). Copy obeys [inv: repo-english-only], [inv: no-em-dash].
2. **`brand/` is the asset factory - gitignored, local-only.**
   `brand/ldat/build.js` rasterizes the master coin mark
   `brand/ldat/ldat-icon.svg` with the frontend's sharp (no rsvg/cairo on
   this machine) into icon PNGs 32..1024 plus banners: 16:9, CoinGecko
   1920x607, DexScreener 1500x500, Linea Hub 1920x1080, event cards,
   Telegram icon. The GeckoTerminal banner is a separate crop-safe
   derivative outside build.js (`brand/ldat/ldat-banner-geckoterminal.svg`,
   rendered one-off 2026-06-30 to 2560x860 PNG plus a 1280x430 1x):
   subtext dropped, content scaled 0.88 toward center so
   GT's wide slot cannot clip it. Paste-ready field banks live in
   `brand/listings/` (REGISTRATION-PLAN, COPY-PASTE, STEP8/STEP9/CMC-*).
3. **Site icons and the OG card are build-time satori, not files.**
   `frontend/src/app/icon.tsx`, `frontend/src/app/apple-icon.tsx`, and
   `frontend/src/app/opengraph-image.tsx` render the gradient "DAT" mark
   and the 1200x630 card via next/og - no public/ asset dependency. Origin:
   zero og:image sitewide made every $LDAT link on X/Telegram (the primary
   distribution channel) render a grey text stub. Satori limits are
   pinned in comments: border-image does not render (the gradient bar is a
   real div), and a backgroundClip:text gradient on a stretched flex child
   spans the full content box - alignSelf:"flex-start" shrinks it to the
   glyph run so the ramp actually reaches cyan.
4. **GeckoTerminal is the one aggregator that indexes us - under a dead
   name.** GT indexes Uniswap v4 on Linea (since ~2026-06-05) and picked up
   the pool at launch; it keys v4 pools by the same bytes32 poolId the site
   computes [inv: pool-id-derived-at-runtime] and embeds via
   `frontend/src/components/gecko-chart.tsx`. But GT metadata never saw the
   rename: live-verified 2026-07-17, still LineaDAT/LINEADAT, "LDAT" search
   returns zero. Rename request submitted 2026-07-15 via
   geckoterminal.com/update-token-info (free Regular Pass; Fast Pass $199
   buys speed, not outcome). The clock: coingecko_coin_id is null; once
   CoinGecko lists the token, GT self-serve editing closes and the dead
   name freezes into CoinGecko and every downstream mirror. Fix GT FIRST.
5. **CoinGecko and CMC both rejected on traction.** CoinGecko twice
   (CL0506260024 2026-06-07, CL2006260017 2026-06-23, "lack of organic
   attention"); repeat submissions can disqualify - traction is the lever;
   the ACTIVE package waits in `brand/listings/STEP9-COINGECKO-ACTIVE.md`.
   CMC ticket #1372449 rejected 2026-06-23, hard 30-day cooldown; resubmit
   only under LDAT (`brand/listings/CMC-UPDATE-REPLY.md`). MetaMask wallet
   pricing unblocks ONLY via the main CoinGecko listing - its spot-price
   API reads CoinGecko's coin DB, not GT onchain data.
6. **DexScreener has no v4-on-Linea index at all.** Live: pairs:null; its
   Linea coverage is only etherex and lynex. Root cause: v4 pools are
   bytes32 ids inside the singleton PoolManager, and DexScreener keys off
   pair contract addresses. The fix is a chain-level indexing request to
   support (sent 2026-06-11, `brand/listings/STEP8-DEXSCREENER-DEBANK.md`),
   not the self-serve form; Enhanced Token Info ($299) is pointless until a
   pair exists. DeBank "support new token" (Rabby) was filed the same day.
7. **DefiLlama is feasible via the protocol-TVL path.** Fork
   DefiLlama-Adapters, add a ~40-line projects/ldat adapter modeled on the
   live iAERO one (sumTokens2, treasury-holds-tokens shape). Their DAT
   dashboard is structurally out of reach (needs share prices and SEC
   filings). Plan: `docs/90-seo-roadmap.md` W5.
8. **Linea Hub: app resubmission pending, token under review.** The old
   public submit form is gone; listing goes through the account-gated
   developer.linea.build (owner only). The package - re-shot 2026-06-20,
   all-LDAT - is ready in `brand/linea-hub/SUBMISSION.md` plus shots/. The
   token was submitted separately 2026-06-23 with a flagged caveat: the
   Hub's generic Uniswap "Buy this token" deep-link cannot work for a
   distributor-gated token [inv: transfers-distributor-gated]; the proposed
   fix points the button at our own /dats/<address> swap page.

## Owns

`brand/` (gitignored, local-only: ldat/, linea-hub/, listings/, telegram/,
logo-candidates/, logo-ldat/, `brand/x-launch-thread.md`), `frontend/src/app/icon.tsx`,
`frontend/src/app/apple-icon.tsx`, `frontend/src/app/opengraph-image.tsx`,
`frontend/src/components/icons/token-icons.tsx`, and the brand statics in
frontend/public: `frontend/public/ldat-icon-200.png` / -512,
`frontend/public/onchaindat-mark.svg`, ldat-banner-geckoterminal*.png.

## Local invariants

None owned outright. Reads [inv: pool-id-derived-at-runtime],
[inv: transfers-distributor-gated], [inv: repo-english-only],
[inv: no-em-dash].

## Verify

- GT rename landed? curl -s "https://api.geckoterminal.com/api/v2/networks/linea/tokens/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5"
  | grep -o '"symbol":"[^"]*"' -> want "LDAT" (still "LINEADAT" 2026-07-17).
- DexScreener indexed? curl -s "https://api.dexscreener.com/latest/dex/tokens/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5"
  -> non-null pairs means point 6 is done.
- MetaMask prices us? curl -s "https://price.api.cx.metamask.io/v1/chains/59144/spot-prices?tokenAddresses=0x02F289E429655d0C0D713A7dFD26850A81f7cFC5&vsCurrency=usd"
  -> non-empty only after a CoinGecko ACTIVE listing.
- https://www.on-chaindat.com/ldat-icon-200.png must stay 200 - CMC and Hub forms cite it.
- NODE_PATH=frontend/node_modules node brand/ldat/build.js (from repo root;
  sharp resolves only from frontend/node_modules, plain node fails)
  regenerates the asset set - GT banner PNGs are NOT among its outputs;
  sips the prebuilt GT banner -> 2560x860.

## Gotchas

- `brand/` exists only on this machine: ticket numbers, the CMC
  anti-phishing code, and all submission drafts have no git backup.
- The GT banner copies in frontend/public are UNTRACKED - not live on www
  (Vercel builds from git); never cite that URL in a form. The tracked
  ldat-icon-200/512.png ARE live.
- `brand/linea-hub/on-chaindat-banner.png` is byte-identical to
  `brand/linea-hub/banner-orbit.png` - the Linea-derived orbit visual
  Consensys banned. Upload `brand/linea-hub/ldat-hub-banner.png` only.
- GT form traps (hit or nearly hit 2026-07-15): no name/symbol field (ask
  in "Additional Information", quoting the rename tx); the contract field
  is case-sensitive - pick GT's own dropdown entry; socials are handles,
  not URLs; NEVER enable Community Takeover - the owner IS the dev.
- Copy rots: `brand/listings/COPY-PASTE.md` still said "non-transferable
  by design" three weeks after the relay shipped, and GT verifies claims
  against the site. Sweep the field banks before every submission.
- GT 24h volume reads higher than the site: it counts the hook's internal
  fee-sell swap on every buy (gross vs user trades). Expected.
- `brand/linea-hub/shots/live-dat-page.png` has the chart card collapsed
  on purpose (GT embed still says LINEADAT/USD); re-shoot post-rename.
- Brand sweeps are surgical: case-sensitive LINEADAT|LineaDAT (no letter
  after) -> LDAT; preserve contract class names, Fly apps, $LINEA, Linea.

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- project_dexscreener_v4_linea.md - the aggregator saga: v4 invisibility
  root cause, every rejection, the GT stale-ticker clock.
- project_ldat_logo.md - logo lineage, build.js asset set, the rename
  ceremony (odd-length-calldata revert on the first try).
- project_linea_hub_assets.md - delisting, the moved submission portal,
  icon/banner specs, the token-page buy-button caveat.
- project_brand_rename.md - the 2026-05-05 naming reorg (LINEASTR freeze).
