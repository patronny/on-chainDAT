# on-chainDAT / LDAT: SEO Strategy and Execution Roadmap

**Synthesis date: 2026-07-15.** All live claims below were re-verified today by curl/API against production, and two of the audit's core recommendations were empirically tested against the repo (Next 15.5.15, wagmi 2.14.11, RainbowKit 2.2.4). Two of them were wrong in a way that materially changes the plan. See section 2.

---

## 1. Strategic verdict: no, this site will not earn meaningful Google traffic. Fix it anyway, for three other reasons.

**The blunt answer to "can this site realistically attract Google traffic":** a few hundred visits per month at 12 months, essentially all of it brand/navigational, and only if everything below ships. Anyone forecasting thousands is selling something.

**Why the ceiling is that low, causally:**

- The domain is ~2 months old with effectively **one** real inbound citation (GeckoTerminal). Verified today: Common Crawl has zero captures across CC-MAIN-2025-33 and CC-MAIN-2026-25; Wayback has zero snapshots. Open-web crawlers have never fetched this domain.
- This is **not a penalty signature, it is an absence signature.** You cannot be suppressed from an index you were never discovered for. That is good news: the site is clean, and clean is recoverable.
- The category terms are unwinnable at any authority level this project will reach. "digital asset treasury", "what is a DAT", "mNAV", "DAT stocks" are decided by CNBC, The Block, DLA Piper, Halborn, DefiLlama, ARK. Zero small sites appear in those top-10s. That is a domain-authority and entity-status SERP, not a content SERP.
- The search volume that exists for "DAT" belongs to **equities-flavored intent** (which companies hold BTC, which DAT stock to buy). Those searchers want tickers and trackers. They are not this product's audience even when the keywords match. Matching keywords to non-matching intent produces bounces, not conversions.

**Where the value actually is, ranked by expected return:**

| Channel | Why it wins here | Realistic size |
|---|---|---|
| **1. Aggregators** (GeckoTerminal, CoinGecko, DexScreener, DefiLlama, Linea Hub) | These outrank your own site for your own brand terms and are the reflex discovery surface for a token. Currently: GT calls you a dead name, CoinGecko has nothing, DexScreener has nothing, DefiLlama has nothing. | 10x-50x whatever organic delivers |
| **2. AI citation** (ChatGPT, Perplexity, Claude, AI Overviews) | Citation selection rewards **specificity over domain authority**. The "protocol-native DAT" definition is genuinely uncontested. Non-JS AI crawlers currently receive an empty page from every URL. | Small but the only channel where a zero-authority domain beats CNBC |
| **3. Brand/navigational Google** | The one query class with no authority barrier. Currently at zero and polluted: "LDAT" resolves to Barco's projector hardware, and "Digital Asset Treasury" as a token name is already taken by a Solana memecoin on CMC. | 100-400 visits/month at month 12 |
| **4. Category organic** | Fantasy. See section 6. | ~0 |

**The strategic call:** the highest-leverage single item in this entire report is not on the website. It is a **GeckoTerminal metadata form**, and it is on a closing clock. See W0.1.

The second-highest is a **semantic land-grab**: Injective is currently defining "onchain DAT" in public to mean *tokenized corporate treasury equity* (SBET), amplified by crypto.news, CryptoBriefing, ChainCatcher, Bitget. You own the exact-match domain for a term whose public meaning is being written by someone else, to mean something else. That window closes as the term ossifies.

---

## 2. Two corrections to the audit that change the plan

I tested the two most expensive recommendations. Both were wrong, and both get **cheaper**, not more expensive.

### 2.1 The `ssr:false` boundary is unnecessary at current versions. The fix is 3 lines, not a restructure.

Every finding in the audit assumed the `indexedDB is not defined` prerender crash documented at `providers.tsx:9-11` is real, and therefore prescribed either (a) `cookieStorage` (wrong: the audit itself correctly refuted this) or (b) pushing the boundary down to 7 leaf components (medium effort, ~1 day, real regression risk).

**I tested it.** I replaced `frontend/src/app/providers.tsx` with a static re-export and ran `npx next build`:

```
✓ Generating static pages (26/26)
```

The build **succeeds**. The prerendered HTML:

| Route | Before (live today) | After (built with `ssr:false` removed) |
|---|---|---|
| `/` | h1=0, a=0, text=40 chars | **h1=1, a=22, text=1,709 chars** |
| `/about` | h1=0, a=0, text=40 chars | **h1=1, a=20, text=6,107 chars** |
| `/terms` | h1=0, a=0, text=23 chars | **h1=1, a=28, text=46,632 chars** |
| `/contacts` | h1=0, a=0, text=15 chars | **h1=1, a=27, text=2,106 chars** |
| `/transfer` | h1=0, a=0, text=15 chars | **h1=1, a=19, text=873 chars** |
| `/status` | h1=0, a=0 | **h1=1, a=19, text=915 chars** |

The comment at `providers.tsx:9-11` documents a **stale, version-specific failure**. Supporting evidence: `grep -rl "indexedDB" node_modules/wagmi/dist/esm` returns **nothing**, and the same grep against `node_modules/@rainbow-me/rainbowkit/dist` returns **nothing**. indexedDB lives only in `@walletconnect/{core,ethereum-provider,sign-client,universal-provider}`, which wagmi's WalletConnect connector imports **lazily** inside `getProvider()`, not at module scope. `wagmi-client.ts:44` already sets `ssr: true`.

**Consequence: the #1 item drops from "medium / 1 day / regression risk" to "trivial / 1 hour + a browser smoke test."** I reverted the file; the worktree is clean.

### 2.2 `alternates: { canonical: "./" }` in the root layout IS safe and IS per-route. One line, not 18 files.

Six separate audit findings warn: *never put `alternates.canonical` in a layout, Next.js inherits it to children and would self-canonicalize the whole site to one URL, causing mass deindexing.* That warning is **correct for `canonical: "/"`** and **wrong for `canonical: "./"`**, and every finding tested only the former.

Verified in the installed Next 15.5.15 source, `node_modules/next/dist/lib/metadata/resolvers/resolve-url.js:87-92`:

```js
function resolveRelativeUrl(url, pathname) {
    if (typeof url === 'string' && url.startsWith('./')) {
        return _path.default.posix.resolve(pathname, url);
    }
    return url;
}
```

and `resolve-basics.js:114` passes the live `pathname` into it. Verified by execution:

```
/                        -> https://www.on-chaindat.com/
/about                   -> https://www.on-chaindat.com/about
/docs/faq                -> https://www.on-chaindat.com/docs/faq
/docs/dat-types/classic  -> https://www.on-chaindat.com/docs/dat-types/classic
/dats/0x02F289...cFC5    -> https://www.on-chaindat.com/dats/0x02F289...cFC5
```

**Consequence:** one line in `layout.tsx` emits a correct self-referencing canonical on **every route**, and because the middleware rewrite makes the internal pathname `/docs/faq` on **both** hosts, it simultaneously fixes:

- zero-canonical-sitewide
- docs.on-chaindat.com duplication (both hosts emit the identical www canonical, no `headers()` logic needed)
- lineastr.vercel.app duplication (the alias emits a www canonical)
- query-string / utm / trailing-slash variants

Effort drops from "small / 18 files" to **one line**.

---

## 3. The roadmap

Dependency-ordered. Waves 0 and 1 can run in parallel (one is off-site, one is code). Nothing in Waves 3-5 pays off until Wave 1 ships.

---

### WAVE 0 - Off-site, this week, ~3 hours total. Highest ROI in the report. Order is not optional.

#### W0.1 - GeckoTerminal ticker rename. Do this before anything else.

**What.** Submit the GeckoTerminal "Update Token Info" form to change name/symbol from `LineaDAT`/`LINEADAT` to `LDAT`/`LDAT`.

**Why.** Verified live today:

```
GeckoTerminal API : name: LineaDAT   symbol: LINEADAT   coingecko_coin_id: None
On-chain eth_call : name() -> LDAT   symbol() -> LDAT
```

The on-chain rename happened 2026-06-20. Five weeks later the **only real backlink this domain has** still calls the token by a dead name. Every dollar of brand equity spent on "LDAT" points at a search that returns zero results.

**The clock:** `coingecko_coin_id` is `null`. CoinGecko's own support policy states that once a token is listed on CoinGecko, its info can **no longer be edited from GeckoTerminal**. The cheap self-serve window is open **right now** and slams shut the moment CoinGecko lists. If the CoinGecko submission lands while GT still says LINEADAT, the dead name gets frozen into CoinGecko and every downstream mirror (Coinbase price pages, Coinranking, Defined.fi, LLM answers).

**Where.** `https://www.geckoterminal.com/update-token-info`. Attach: Lineascan verified contract showing `name()/symbol() == LDAT`, rename tx `0x697217ac`, and the on-chaindat.com brand page.

**Effort.** 20 minutes. **Impact.** High.

**Verify.** `curl -s "https://api.geckoterminal.com/api/v2/networks/linea/tokens/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5" | grep -o '"symbol":"[^"]*"'` returns `"symbol":"LDAT"`, and `search/pools?query=LDAT&network=linea` returns a non-empty `data` array (today: `[]`).

#### W0.2 - Fix the GitHub repo homepage and description.

**What.** Repo settings for `patronny/on-chainDAT`: set homepage to `https://www.on-chaindat.com`, rewrite the description.

**Why.** Verified live today:

```
homepage:    https://lineastr.vercel.app
description: on-chainDAT - perpetual on-chain Digital Asset Treasury.
             First launch: LineaDAT ($LINEADAT) on Linea.
             Phase 3 testnet runs as $LINEASTR on Base Sepolia.
```

github.com is one of the few high-authority domains you can realistically get a crawl path from, and it currently points at the **duplicate clone host**, not the real domain. The description is also two rebrands stale and contains an em-dash (repo convention violation).

New description: `on-chainDAT - perpetual on-chain Digital Asset Treasury platform. First launch: LDAT on Linea.`

**Effort.** 5 minutes. **Impact.** Medium. Nofollow, so no PageRank, but it is a genuine crawl-discovery path and a brand-entity signal, and right now it feeds the wrong host.

**Verify.** `curl -s https://api.github.com/repos/patronny/on-chainDAT | grep homepage` shows the www domain.

#### W0.3 - Create the Wayback age record.

**What.** Submit `https://www.on-chaindat.com/` to `web.archive.org/save`.

**Why.** Zero snapshots exist. No independent existence/age record in a vertical full of sites that vanish. It is permanent and takes 30 seconds.

**Effort.** 30 seconds. **Impact.** Low but free.

**Verify.** `curl 'https://archive.org/wayback/available?url=on-chaindat.com'` returns a non-empty `archived_snapshots`.

#### W0.4 - Linea Hub submission.

**What.** Submit the staged assets in `brand/linea-hub/` to `linea.build/hub`.

**Why.** Every stated Hub requirement is already met: live on Linea mainnet since 2026-06-09, contract verified on Lineascan, assets and copy staged. This is a free, topically-relevant, high-authority ecosystem listing blocked on nothing but someone submitting a form. **Caveat from project memory:** the assets were shot before the LDAT rebrand. Check for the old LINEADAT wordmark first and bundle this with W0.1 so all public surfaces flip to LDAT in one pass.

**Effort.** 30 minutes including the asset check. **Impact.** Medium.

#### W0.5 - Verify X and Telegram profiles carry the domain.

**What.** Confirm `x.com/PaTRoN4egLabs` and `t.me/onchainDAT` exist, are active, and have `https://www.on-chaindat.com` in the **profile URL field**, not just in a post.

**Why.** I could not verify this. x.com returns HTTP 200 for any handle string, so a status check proves nothing. If these profiles do not carry the link, you are missing your cheapest crawl path and your only realistic distribution channel. Blunt: if the X account is dormant, that is a bigger growth problem than every on-page item in this report combined. A zero-authority crypto domain does not rank its way to an audience. It gets an audience first and ranks as a consequence.

**Effort.** 10 minutes.

---

### WAVE 1 - Render and discovery. Nothing else works until this ships. ~4 hours.

#### W1.1 - Delete the `ssr:false` boundary. **[THE fix. Everything downstream depends on it.]**

**What.** Collapse `providers.tsx` to a static re-export.

```tsx
// frontend/src/app/providers.tsx  (replaces lines 1-31 entirely)
"use client";

export { Providers } from "./providers-impl";
```

**Why.** `frontend/src/app/layout.tsx:39` renders `<Providers>{children}</Providers>`, and `frontend/src/app/providers.tsx:20-26` defines Providers as `dynamic(..., { ssr: false, loading: () => null })`. The server renders `null` for the **entire route tree**. Verified live today on the homepage: `BAILOUT count: 2, canonical: 0, og:image: 0, ld+json: 0, a href: 0, h1: 0`.

This single defect is the root cause of **nine** separate audit findings across five dimensions (see section 7). It means:

- Zero crawlable internal links sitewide. Combined with no sitemap, there is **no non-JS discovery path to any URL beyond the homepage.** Both discovery channels are dead simultaneously. That is why this is critical rather than merely bad.
- GPTBot, ClaudeBot, PerplexityBot, CCBot and every social unfurler execute no JavaScript. They see a `<title>` and nothing else. For a product whose distribution is X and Telegram links plus AI-assisted research, this alone accounts for near-zero AI visibility.
- Googlebot renders JS, so classic indexing degrades to a deferred second-wave queue rather than dying outright. **That is exactly why this went unnoticed.**
- Only 8 of ~40 components consume wagmi. The entire site is being sacrificed for 8 leaves.
- Mobile Lighthouse performance 27, LCP 9.5s, TBT 2,720ms are downstream of this too: nothing can paint until ~1.1MB of parsed JS executes.

**Also delete the false comment** at `providers.tsx:16-18` ("stat tiles + page content render normally") - it is the reason this shipped.

**Files.** `frontend/src/app/providers.tsx` (only).

**Effort.** 3 lines + a browser smoke test. **Impact.** High. This is worth more than every other item in this report combined.

**Risk and how to retire it.** The build is proven (26/26 static pages, above). The residual risk is **runtime hydration**, not prerender: the server now renders the wagmi tree with no wallet, then the client hydrates with wallet state. `wagmi-client.ts:44` already sets `ssr: true`, which exists precisely to make that initial state deterministic. Smoke test in a real browser before merging: connect wallet, swap on `/dats/0x02F289...cFC5`, transfer on `/transfer`, load `/portfolio`.

**Follow-up (optional, NOT a crash fix):** add `storage: createStorage({ storage: cookieStorage })` to `wagmi-client.ts` for hydration continuity, so users do not see a flash of "not connected" before reconnect. The audit repeatedly framed cookieStorage as the indexedDB fix. It is not. It replaces wagmi's own storage and never touches WalletConnect. Treat it as UX polish after W1.1, and do not expect it to change SSR output.

**Verify.**
```bash
curl -sL https://www.on-chaindat.com/about | grep -o '<h1' | wc -l          # expect 1 (today: 0)
curl -sL https://www.on-chaindat.com/ | grep -o '<a ' | wc -l               # expect >=20 (today: 0)
curl -sL https://www.on-chaindat.com/docs/ldat | python3 -c "
import re,sys;h=sys.stdin.read()
b=re.sub(r'(?is)<script.*?</script>|<style.*?</style>|<template.*?</template>','',h)
m=re.search(r'(?is)<body[^>]*>(.*)</body>',b)
print(len(re.sub(r'\s+',' ',re.sub(r'(?s)<[^>]+>',' ',m.group(1))).strip()))"          # expect >2000 (today: 16)
```

Note `grep -c '<h1'` **does not work** as a CI gate: Next serves the whole document on one line, so `-c` counts lines and can never return more than 1. Use `grep -o '<h1' | wc -l`.

One residual `BAILOUT` template remains after `</footer>` (the TermsGate/CookieConsent modal leaf). It carries no indexable content. Ignore it.

#### W1.2 - One-line sitewide canonical.

**What.**

```ts
// frontend/src/app/layout.tsx:13-23, add one key to the existing metadata object
export const metadata: Metadata = {
  title: "LDAT - Perpetual, Automated DAT on Linea",
  description: "...",
  metadataBase: new URL("https://www.on-chaindat.com"),
  alternates: { canonical: "./" },   // <- per-route, resolves against metadataBase + pathname
  openGraph: { /* ... */ },
};
```

**Why.** See section 2.2. `metadataBase` is already correct at `layout.tsx:17`; it alone emits **no canonical tag** (it only resolves relative OG URLs). The `"./"` form resolves per-route via `resolveRelativeUrl`, verified in the installed Next source and by execution. Because the middleware rewrite at `src/middleware.ts:42` makes the internal pathname `/docs/faq` on **both** hostnames, `docs.on-chaindat.com/faq` will emit `https://www.on-chaindat.com/docs/faq` automatically, with no `headers()` logic and no per-page work.

**Host decision, made explicitly:** **www.on-chaindat.com is canonical.** `metadataBase` already targets it, the apex already 307s to it, `docs/tokenomics/page.tsx` hardcodes 4 absolute www links, and all internal nav uses `/docs/*`. The subdomain stays alive as a branded human alias that consolidates to www. Do not chase the "subfolders beat subdomains for equity" folklore - Google treats them equivalently. The real defect is two 200-returning hosts with no disambiguation, and this fixes that.

**Files.** `frontend/src/app/layout.tsx` (one line).

**Effort.** 1 line. **Impact.** High.

**Verify.**
```bash
curl -sL https://docs.on-chaindat.com/faq | grep -o '<link rel="canonical"[^>]*>'
# expect: <link rel="canonical" href="https://www.on-chaindat.com/docs/faq"/>
curl -sL https://lineastr.vercel.app/ | grep -o '<link rel="canonical"[^>]*>'
# expect: href="https://www.on-chaindat.com/"
```

#### W1.3 - robots.ts + sitemap.ts. Ship in the same commit.

**What.** Two new files.

```ts
// frontend/src/app/robots.ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: "https://www.on-chaindat.com/sitemap.xml",
  };
}
```

```ts
// frontend/src/app/sitemap.ts
import type { MetadataRoute } from "next";
const BASE = "https://www.on-chaindat.com";
const ROUTES = [
  "", "/about", "/dats", "/dats/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5",
  "/transfer", "/contacts", "/terms",
  "/docs", "/docs/ldat", "/docs/tokenomics", "/docs/new-launches",
  "/docs/transfer", "/docs/dat-types", "/docs/dat-types/classic",
];
export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((p) => ({ url: `${BASE}${p}` }));
}
```

**Why.** Verified live today: `/robots.txt` 404, `/sitemap.xml` 404, `/llms.txt` 404. Absent from code, not just the server.

Calibrate the reasoning honestly:

- **robots.txt is the LOW half.** A 404 robots.txt means allow-all (RFC 9309). Nothing is blocked today. The critical failure mode is a **5xx** robots.txt (Google halts crawling sitewide); 404 is the benign one. Its only real value is carrying the `Sitemap:` line for non-Google crawlers (Bing, AI crawlers) that lack a submission channel.
- **sitemap.xml is the HIGH half**, and it matters more here than on a normal 16-page site precisely because W1.1 has not shipped yet: with zero server-rendered anchors, the sitemap is the **only** machine-readable discovery channel that does not require JS execution.

**Deliberate omissions and why:**
- No `lastModified: new Date()`. It stamps every URL as modified-at-build-time on each deploy and trains Google to distrust your lastmod. Omit it or derive from real git mtimes.
- No `priority` / `changeFrequency`. Google ignores both.
- No `host:` field. Yandex-only, deprecated since 2018, ignored by Google and Bing.
- **No `disallow: ["/portfolio", "/status"]`.** Disallow does **not** deindex - a disallowed-but-linked URL can still be indexed URL-only, and Disallow actively **prevents** Google from ever reading a `noindex` tag. Use meta robots for those (W3.1).
- `/docs/faq`, `/docs/dat-types/yield`, `/portfolio`, `/status` are excluded from the sitemap. Three are empty; two are wallet-gated. Do not submit URLs you would be embarrassed to have crawled.
- Note: `src/middleware.ts:50` excludes dotted paths (`.*\..*`), so both files bypass the docs rewrite and serve identically on `docs.on-chaindat.com`. That is acceptable given allow-all plus an absolute www Sitemap URL.

**Effort.** 20 minutes. **Impact.** High (sitemap), low (robots).

**Verify.** `curl -s https://www.on-chaindat.com/sitemap.xml | grep -c '<url>'` returns 14, and the body is XML, not the Next 404 page. **Check bodies, not status codes** - the audit's own competitor research caught two false positives where SPA catch-alls returned 200 with `index.html` for `/llms.txt`.

#### W1.4 - Kill the duplicate host.

**What.** In the Vercel `lineadat` project, set `lineastr.vercel.app` to **308 redirect** to `https://www.on-chaindat.com`.

**Why.** Verified today: `lineastr.vercel.app/` returns **200** with a title byte-identical to production. `/docs/faq` is live there too. It is a complete, crawlable, indexable clone with no canonical, no noindex, no `x-robots-tag`. `docs/60-deployment-runbook.md:141` already documents that "old `lineastr.vercel.app` redirects", so a 308 **restores documented intent**. No repo code or ops script depends on the alias (`.github/scripts/` has zero `vercel.app` references). Per project memory it is legacy-only.

A redirect is strictly better than relying on W1.2's canonical: it removes the host from crawl budget entirely rather than relying on Google honoring a hint, **and it forwards the GitHub link equity** rather than discarding it. There is no evidence the host is currently indexed (`site:lineastr.vercel.app` returns nothing), so this is latent risk being closed cheaply.

**Caveat.** The alias also serves `/api/indexer` and `/api/keeper-status` at 200. A host-level 308 covers those too. 308 preserves method and body and nothing in the repo calls that origin, so risk is low - but verify after.

**Effort.** 5 minutes. **Impact.** High.

**Verify.** `curl -sI https://lineastr.vercel.app/ | head -1` returns `HTTP/2 308`.

---

### WAVE 2 - Indexation. Ships the day Wave 1 lands. ~1 hour.

#### W2.1 - Google Search Console + Bing Webmaster.

**What.** Verify a **domain property** in GSC via DNS TXT (covers apex + www + docs subdomain in one property). Then import the property into Bing Webmaster.

**Why.** Verified: `grep -rniE 'google-site-verification|BingSiteAuth|msvalidate'` over `frontend/src/`, `frontend/public/`, `next.config*` returns **zero matches**. `/BingSiteAuth.xml` 404. `layout.tsx:13-23` has no `verification` key.

Right now you are flying blind: you cannot distinguish "not crawled yet" from "crawled and suppressed", cannot submit a sitemap, cannot request indexing, and would not receive a manual action notice - which matters enormously in the crypto vertical. GA4 (G-FE3G03SSJ8) is analytics; it provides zero indexation capability.

**Bing is undervalued here specifically** because it feeds ChatGPT search, and AI surfaces are the channel where a zero-authority domain competes on content quality rather than domain age.

**Effort.** 30 minutes (DNS propagation is the long pole). **Impact.** High.

**Verify.** GSC shows the property verified; sitemap submitted and read; URL Inspection on `/`, `/about`, `/docs/ldat`, `/docs/tokenomics` returns "URL is on Google" within 2-3 weeks.

#### W2.2 - Request indexing on the 5 pages that matter.

`/`, `/about`, `/docs/ldat`, `/docs/tokenomics`, `/dats/0x02F289...cFC5`. Manual requests genuinely work for getting a handful of URLs fetched on a new domain. They do not make you rank. But you cannot rank unindexed.

#### W2.3 - Apex and middleware redirect status codes. Drive-by only.

**What.** Two status-code corrections, bundled with work you are already doing.

```bash
# apex: 307 -> 308. Vercel's redirectStatusCode is null (unset); its default for unset is 307.
# There is no "Temporary" toggle to un-flip, so use the API:
curl -X PATCH "https://api.vercel.com/v9/projects/lineadat/domains/on-chaindat.com" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d '{"redirect":"www.on-chaindat.com","redirectStatusCode":308}'
```

```ts
// frontend/src/middleware.ts:36 - the comment at line 11 claims 308, the code emits 307
return NextResponse.redirect(url, 308);
```

**Why.** Verified today: `curl -sI https://on-chaindat.com/` returns `HTTP/2 307` + `location: https://www.on-chaindat.com/`. Direction, hop count and path preservation are all correct; only the status is non-permanent.

**Be honest about the size of this:** it is **low severity**. The apex never serves 200 on any path, so there is no cross-host duplicate content and no meaningful signal split. Google consolidates long-lived temporary redirects anyway. The middleware one is pure comment-accuracy hygiene - those stray `/docs/*` URLs on the subdomain appear in zero server-rendered hrefs. Shipping 308 while the site emits zero canonicals would have fixed the least important of the three. Now that W1.2 and W1.4 are landing, this is a free add-on.

**One caution:** 301/308 are cached aggressively and hard to reverse. Given this project's rename history (LINEASTR -> LineaDAT -> on-chainDAT, with the LDAT rebrand recorded as "reversible until Phase G"), a deliberate 307 on the apex is a defensible holding position. The middleware fix is safe unconditionally.

---

### WAVE 3 - Metadata hygiene. ~4 hours. Only pays off post-W1.1.

#### W3.1 - Per-route metadata for the 5 routes that have none.

**What.** Verified today by grep - exactly five `page.tsx` files lack a metadata export:

```
NO METADATA: src/app/about/page.tsx
NO METADATA: src/app/dats/[address]/page.tsx
NO METADATA: src/app/dats/page.tsx
NO METADATA: src/app/page.tsx        <- CORRECT AS-IS, do not touch
NO METADATA: src/app/status/page.tsx
```

Four of them inherit the homepage title verbatim, so five URLs compete on one string. `/dats/[address]` is the **conversion page** (the homepage CTA at `page.tsx:54` links straight to it) and is currently indistinguishable from the homepage in a SERP.

```ts
// src/app/about/page.tsx
export const metadata: Metadata = {
  title: "How LDAT Works - Digital Asset Treasury on Linea",
  description: "How the LDAT treasury accumulates $LINEA, resells it P2P at a markup, and burns $LDAT with the proceeds. Slow-rug protection and the path to immutable contracts.",
};

// src/app/dats/page.tsx
export const metadata: Metadata = {
  title: "DAT Explorer - All Digital Asset Treasuries on Linea",
  description: "Browse every live digital asset treasury (DAT) on Linea L2. Compare treasury size, burn rate, market cap and mNAV across classic and yield DATs.",
};
```

**`/status` needs a LAYOUT, not a metadata export.** `src/app/status/page.tsx:1` is `"use client"`, and Next.js forbids exporting `metadata` from a client component - the audit's own snippet **would fail the build**:

```ts
// src/app/status/layout.tsx  (NEW FILE)
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Live Protocol Status - LDAT Keeper, Treasury and Burns",
  robots: { index: false, follow: true },
};
export default function StatusLayout({ children }: { children: React.ReactNode }) { return children; }
```

**`/portfolio`** - add `robots: { index: false, follow: true }` to the existing metadata object at `portfolio/page.tsx:9`. Use `follow: true` so internal links still pass equity. Both routes render empty shells to a crawler and have zero plausible search demand. This is **low severity** - Google will most likely never index them anyway.

**`/dats/[address]`** - see W3.4. Do **not** add per-address `generateMetadata` yet; the route ignores its param.

**Bonus defect I found that the audit missed:** `/dats` and `/portfolio` **author no `<h1> at all`** (`grep -n "<h1" src/app/dats/page.tsx src/app/portfolio/page.tsx` returns nothing, and my prerender test confirms `h1=0` on both even after the SSR fix). The audit's claim that source heading structure is "healthy - exactly one h1 per route" is false for these two. Add one to `/dats`.

#### W3.2 - Docs metadata: unbranded index title + 9 identical descriptions.

**What.** Two related defects.

```ts
// src/app/docs/page.tsx - /docs currently emits a bare <title>Overview</title>
export const metadata: Metadata = {
  title: { absolute: "Documentation - LDAT" },
  description: "Start here: what a digital asset treasury (DAT) is, how the LDAT protocol accumulates and resells $LINEA, and how the burn cycle works on Linea L2.",
};
```

**Why the bare title happens:** in Next.js a layout's `title.template` applies to **child segments only**, not to the `page.tsx` in its own segment. So `docs/layout.tsx:6`'s `template: "%s - LDAT Docs"` never fires for `/docs`. `title.absolute` documents the intent and survives the file later moving into a child segment. **Scope the audit missed:** `src/middleware.ts:21` maps `["docs.", "/docs"]`, so `docs.on-chaindat.com/` **root** also serves `<title>Overview</title>`. This is not a section index - it is the canonical entry point of the entire docs product, and it is titled with a dictionary word.

**Then the descriptions.** All 9 docs pages inherit one string from `docs/layout.tsx:7-8`. Give the **six pages with real content** their own (`/docs`, `/docs/ldat`, `/docs/tokenomics`, `/docs/new-launches`, `/docs/transfer`, `/docs/dat-types/classic`). Do **not** write bespoke answer-promising descriptions for `/docs/faq`, `/docs/dat-types`, `/docs/dat-types/yield` - they are empty (W4.1). An answer-promising snippet on an empty page is a SERP-to-page mismatch that invites bounce. The inherited section description is the honest placeholder until content ships.

**A trap the audit's one-liner walks into:** `layout.tsx:20` explicitly sets `openGraph.description`. In App Router, a page-level `description` does **not** backfill `og:description` when an ancestor set it explicitly. So `export const metadata = { title: "FAQ", description: "..." }` fixes `<meta name="description">` and leaves `og:description` duplicated on all nine. Each page needs `openGraph: { description: "..." }` too if per-page social/AI-crawler snippets are the goal.

**Expected effect: SERP CTR on six pages. Not rankings.** Meta description is not a ranking factor and Google frequently rewrites it.

#### W3.3 - Make the docs tree static, and fix Lighthouse's meta-description failure at the root.

**What.** Remove the `headers()` dependency from `frontend/src/app/docs/layout.tsx:20`.

**Why this is a real finding and not cosmetic.** My build output shows the entire docs tree is `ƒ (Dynamic) server-rendered on demand`, while `/`, `/about`, `/terms` etc. are `○ (Static)`. The sole cause is:

```ts
// src/app/docs/layout.tsx:20-24
const headersList = await headers();
const isSubdomain = host.startsWith("docs.");
return <DocsShell isSubdomain={isSubdomain}>{children}</DocsShell>;
```

`await headers()` forces the whole subtree dynamic, which triggers Next.js **streaming metadata** - and that is why Lighthouse reports "Document does not have a meta description" on `/docs/faq`. The description is **not missing**; it is emitted inside `<body>` instead of `<head>`. Lighthouse queries `head meta`, finds nothing, scores 0. Google most likely ignores a body-placed description and generates its own snippet.

**This is the correction that matters:** do **not** ship per-page `description:` exports expecting the Lighthouse audit to pass. Placement is the blocker, not content.

**Fix.** Resolve the subdomain in middleware (rewrite to a route group or inject a path param) instead of reading `headers()` in the layout, or move the `isSubdomain` read into a client component. Then the 9 docs pages prerender statically and metadata returns to `<head>`.

**Effort.** 2 hours (middleware refactor). **Impact.** Medium. Bundle with W3.2.

**Verify.** `npx next build` shows `○` not `ƒ` for `/docs/*`; Lighthouse `meta-description` audit scores 1 on `/docs/faq`.

#### W3.4 - Gate `/dats/[address]`.

**What.** Three changes in one commit.

```tsx
// src/app/dats/[address]/page.tsx
import { notFound } from "next/navigation";
import { isAddress } from "viem";

const KNOWN = new Set(["0x02f289e429655d0c0d713a7dfd26850a81f7cfc5"]);

export default async function StrategyPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address, { strict: false }) || !KNOWN.has(address.toLowerCase())) notFound();
  // ...
}
```

**Why.** `page.tsx:7` is literally `await params;` - the param is awaited and **discarded**. `strategy-header.tsx:11,27` hardcodes `ADDR.strategy`. `useParams` appears nowhere in `src/`. So every `/dats/<anything>` renders a byte-identical clone of the LDAT page. Verified today: `/dats/contract` returns **200**.

**Reframe the harm honestly.** This is **not** "unbounded soft-404 index bloat" - with no sitemap and no enumeration source, crawlers do not invent `0xdeadbeef`. The real defects are:

1. **One live crawlable junk URL already exists:** `src/app/docs/tokenomics/page.tsx:67` renders `<a href="https://www.on-chaindat.com/dats/contract">` in the served payload. That is a docs bug - a placeholder illustrating URL format shipped as a real clickable link. **Demote it to `<code>` in the same commit**, or the gate turns a documented link into a hard 404.
2. **Impersonation surface.** `/dats/<scam-address>` renders LDAT's real treasury data under an arbitrary address. That is the strongest argument here, and it is not an SEO argument.
3. The real money page duplicates the homepage title.

**Two correctness traps in the audit's version:**
- Use `isAddress(address, { strict: false })`. viem 2.22.17's default `strict: true` returns **false** for all-uppercase and wrong-checksum addresses and would 404 legitimate URLs.
- `isAddress` alone is insufficient - it passes any checksum-valid 20-byte string, so a valid non-DAT address still returns 200 with LDAT content. Check membership, not shape.

**Do NOT** add `alternates: { canonical: \`/dats/${address}\` }` interpolating the raw param - the route returns 200 for the checksummed form, the lowercased form, and garbage, so a raw self-canonical would **manufacture** duplicate URLs. W1.2's `"./"` canonical already handles this correctly once the gate rejects everything but the one known address.

**Do NOT** add indexer-sourced per-symbol titles yet. The page renders LDAT unconditionally; a per-token title would advertise a token the body does not render - worse than today's generic title. A static metadata export naming LDAT is more truthful. Make the route genuinely address-aware **first**, then add `generateMetadata`.

**Also:** `dats-explorer.tsx:242/244/291/293` navigates via `router.push` inside `onClick`, not anchors. Googlebot does not fire click handlers. **Today this is near-harmless** - only one DAT exists (`DATS` array `:44-56`, whose own comment says "Placeholder zeros until DAT #2 exists"), and the money page is already linked from the homepage hero. It becomes a real crawl-path gap the moment AERODAT ships. Wrap the DAT name cell in `<Link>` now, and when you do, remove the leftover `tabIndex={0}`, `onKeyDown` and `role="link"` from the row (`:246`, `:295`) - the anchor supplies keyboard access, and a leftover `role="link"` creates nested-link ambiguity for assistive tech.

#### W3.5 - OG image and social card.

**What.** Add `frontend/src/app/opengraph-image.tsx` using `next/og` `ImageResponse` at 1200x630, and set `twitter.card = "summary_large_image"` plus `openGraph.url` / `siteName` in `layout.tsx:18-22`. Add an `openGraph.title` template mirroring the title chain.

**Why.** Verified live today: `og:image count: 0`, `twitter:card content="summary"`. X, Telegram and Discord are the **primary** distribution channels for this token, and every link a holder posts renders as a grey text stub. `twitter:card` defaults to `summary` precisely because no image is declared.

**Two traps that would ship it broken:**

1. **The banner is not deployed.** `git status` shows `?? frontend/public/ldat-banner-geckoterminal.png` - **untracked**. Verified live today: `https://www.on-chaindat.com/ldat-banner-geckoterminal.png` returns **404**. Pointing `og:image` at a 404 while upgrading to `summary_large_image` produces a **broken large card - strictly worse than today's text card.**
2. **The banner is not 1200x630.** It is 2560x860 (2.98:1). Twitter center-crops `summary_large_image` to 1.91:1, so ~36% of the width is lost and the wordmark likely gets cut.

`opengraph-image.tsx` sidesteps both: build-time generated, no untracked-asset risk, no aspect-ratio risk. Later, add `src/app/dats/[address]/opengraph-image.tsx` rendering live price/treasury/burn - a dynamic OG card is a strong share magnet for a token page.

**Safe interim with zero new assets:** use the already-tracked, already-live `/ldat-icon-512.png` (verified 200 today) and **keep `card: "summary"`**. A square icon in a summary card is correct. It must never be paired with `summary_large_image`.

Also fix `openGraph.title` at `layout.tsx:19`, currently the bare ticker `"LDAT"` on every page:

```ts
openGraph: {
  title: { default: "LDAT - Perpetual, Automated DAT on Linea", template: "%s - LDAT" },
  url: "https://www.on-chaindat.com",
  siteName: "on-chainDAT",
  type: "website",
}
```

Note `docs/layout.tsx:6` sets its own `template: "%s - LDAT Docs"`, so a root-only OG template produces og:title "FAQ - LDAT" against `<title>` "FAQ - LDAT Docs". Add a matching `openGraph.title` template in `docs/layout.tsx` for an exact mirror. **This is a CTR fix, not a ranking fix** - og:title has zero effect on Google.

#### W3.6 - Rewrite the homepage meta description.

**What.** `layout.tsx:15-16` is 186 chars and spends roughly half of itself on invented terminology.

Current: `"LDAT is a deflationary, perpetual digital asset treasury on Linea L2. Buy and sell bags through a P2P mechanism with built-in slow-rug protection. The protocol burns LDAT on every cycle."`

**Two problems, and the second is bigger than the audit credits.** WebSearch for `"slow rug" crypto protection` returns **only** rug-pull glossaries - the phrase resolves to project abandonment, with no "protection" product category behind it. `"P2P bag mechanism"` returns nothing resembling it. These are strings with plausibly **zero monthly searches worldwide**. Worse, "slow-rug protection" pattern-matches to rug-pull content, so the brand's primary description puts the word "rug" in its own first impression.

Replacement (147 chars, differentiator in the first ~120 so it survives mobile truncation at ~120 chars as well as desktop's ~920px):

```
"LDAT is an on-chain digital asset treasury on Linea L2: an autonomous smart-contract treasury with no company, no shares, no dilution. Every cycle buys and burns LDAT."
```

Keep "bags" and "slow-rug" as **defined glossary entries** inside `/docs`, never as primary positioning. Note this string is currently the **only prose a non-JS crawler sees on the entire site**, which makes it the highest-leverage 155 characters in the codebase until W1.1 ships.

---

### WAVE 4 - Content and truth. ~3 days. Only pays off post-W1.1.

#### W4.1 - Fill or unpublish the three empty docs pages. **Do this BEFORE W1.1 goes live, or ship them together.**

**What.** `src/app/docs/faq/page.tsx`, `src/app/docs/dat-types/page.tsx`, `src/app/docs/dat-types/yield/page.tsx` are each 11-line files whose entire body is one `<h1>`. All three return 200, are linked from `docs-nav.ts:19-27` and `docs-search.ts:55-76`, and carry no noindex.

**Sequencing is the point:** fixing the SSR bailout without writing this copy only exposes three empty pages to crawlers *faster*. This is the one finding W1.1 does not solve.

**`/docs/faq` is the highest-value page on the site and it is blank.** Q&A pairs are the format AI Overviews, ChatGPT and Perplexity extract and attribute. Every source answer already exists in the repo (`docs/page.tsx:10-23`, `docs/ldat/page.tsx:44-58`, `docs/tokenomics/page.tsx:11-14,25-44`, `docs/new-launches/page.tsx:22-31`, `docs/transfer/page.tsx:10-32,65-71`). Write 10-14 `<h2>` questions in natural user phrasing, each answered in a self-contained 40-60 word first paragraph:

- What is a DAT token? (and: **is it the same as a digital asset treasury company?** - the disambiguation question, see W4.4)
- What is $LDAT?
- What is the LDAT trading fee?
- Can the team remove liquidity / rug LDAT?
- Why is the launch fee 99%?
- Why can't I transfer LDAT to another wallet?
- How much does a transfer cost?
- What is the LDAT contract address?
- Is the LDAT contract immutable?
- What is the max supply?

**`/docs/dat-types`** needs only a short hub intro paragraph. Do **not** hand-write child links - `docs-shell.tsx:137-147` already auto-renders subsection cards for any nav parent via `getChildren()`.

**`/docs/dat-types/yield`** - either write the planned model or remove it from `docs-nav.ts` + `docs-search.ts` and noindex it. A "coming soon" page with no body has no ranking value and is a quality liability. Note: this is **not** tense rot - yield DATs genuinely do not exist yet, so the copy is accurate. It is a thin-content problem.

**Two corrections before you write:**

- **Do NOT expect FAQPage rich results.** Google restricted FAQ rich results to government and health sites in **August 2023**. The accordion will not appear. Residual value is LLM/AI parsing only. That makes **writing the content** the win and the schema a small bonus on top, not the reverse.
- **The "fee split contradiction" flagged between `docs/ldat` and `docs/dat-types/classic` is NOT a contradiction.** `classic/page.tsx:11-13` explicitly says "Classic DATs are DAT tokens with economics similar to $LDAT, but with one small difference." $LDAT = 8% $LINEA treasury + 2% project (it **is** the ecosystem token, so it cannot route 1% to burning the ecosystem token, and there is no third-party creator). Classic DATs = 8% base asset + 1% ecosystem-token burn + 1% creator. The docs are internally consistent and the difference is deliberately flagged. Do not "fix" it.

**The strongest argument for W4.1 is not SEO.** A user clicking "FAQ" in the docs nav of a live protocol handling real funds lands on a blank page. That justifies it on its own.

#### W4.2 - Fix the fee number on the two highest-traffic pages. **Do this first in this wave.**

**What.** Two pages state that the full 10% swap fee reaches the treasury. It does not.

- `frontend/src/app/page.tsx:103` - "Every buy or sell of LDAT pays 10% straight to the treasury" **WRONG** (this is the **homepage**, which the audit's version of this finding omitted entirely)
- `frontend/src/app/about/page.tsx:76` - "$ETH builds up in the treasury (10% of every swap)" **WRONG**
- `frontend/src/app/docs/ldat/page.tsx:50-56` - 8% base asset / 2% project **CORRECT, use this wording verbatim**

**Ground truth, verified on-chain** (hook `0xA0FAD88E899D7a70179A473140111AB4016F6444` on Linea 59144): `lineaDATAddress()` = the proxy (self-launch sentinel active), `feeAddressClaimedByOwner(proxy)` non-zero. Per `LineaDATHook.sol:226-248` the split is 80% treasury / 10% burn-share / 10% creator-share, with both non-treasury shares landing on `0x6e0d0108...` = **8% treasury / 2% creator of swap volume**.

**Why this matters more than its size suggests.** On a financial product, a materially wrong number - on the exact figure that determines what a holder's token is worth - on the two most-read pages is both a trust failure and a claim the team would not want to defend. It also gives AI retrieval two irreconcilable answers to "what is the LDAT fee", which suppresses citation confidence.

Leave `page.tsx:73` ("fully-enforced 10% tax") alone - the tax genuinely is 10% and that line does not claim the full amount reaches the treasury.

#### W4.3 - Sweep stage-stale copy.

**What.** Four user-facing strings still describe a testnet, a faucet that does not exist, and the **shipped** `/transfer` relay as future work, five weeks after the 2026-06-09 mainnet launch:

- `contacts/page.tsx:114` - "Stuck with a swap, faucet, or wallet flow on the **testnet UI**"
- `docs/ldat/page.tsx:16` - "The first network to launch **will be** Linea L2"
- `docs/ldat/page.tsx:85` - "**Later**, a dedicated interface **will be added**..." while `/transfer` returns 200 and `/docs/transfer` documents it as shipped
- `about/page.tsx:126` - "For now, **during testnet** and the first months of mainnet..." (the audit missed this one)

**Why.** `/docs/ldat` and `/docs/transfer` **directly contradict each other** on whether the transfer relay exists, and a user reading in nav order hits the false claim first. Neither page carries a date, so retrieval systems have no tiebreaker and tend to suppress the citation entirely. An AI ingesting `/docs/ldat` will tell users LDAT has not launched and transfers are impossible - about a live token with a live transfer UI, sourced from the project's own docs. `grep -rn "2026-06-09\|has launched\|is live" src/app/docs/` finds **no statement of the launch as a fact anywhere in the docs tree**.

**One nuance the audit's fix gets wrong:** `docs/ldat/page.tsx:16`'s paragraph legitimately stays future tense in part ("Each supported network **will** have its own core ecosystem token") because multichain expansion genuinely has not happened. Move **only** the Linea-specific clause to past tense. A blanket rewrite would wrongly imply the multichain rollout is complete.

Rewrite `:16` to a **dated fact** - dated facts are exactly what extractive engines quote: `"$LDAT launched on Linea L2 (chain 59144) on 2026-06-09. Its contract address is 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5."` Rewrite `:61-64`'s "shortly after" to the honest current state (`"The $LDAT contract is currently upgradeable. Upgradeability will be permanently revoked once post-launch testing completes."`) with no fresh timeline you then miss.

**"Last updated" dates:** worth adding, but **only derived from git mtime at build time**. A hardcoded date that itself goes stale is worse than none. Skip the CI grep guard the audit proposes - it would false-positive on legitimately forward-looking roadmap copy, including the honest "will be permanently revoked" wording above.

#### W4.4 - Homepage risk line and the Terms contradiction. **[YMYL - do not skip]**

**What.** Two changes.

**Why.** `grep -niE 'risk|disclaim|not financial|no guarantee|may lose'` on `frontend/src/app/page.tsx` returns **zero matches** across the whole 143-line file. Meanwhile the page markets: `:81` "lists it for resale with a 20% markup", `:117` "**3. Bag goes back on sale at 1.2x**", `:120` "relists that bag for 20% more ETH than it paid", `:86` "Burn Pressure", `:127` "earn a 0.5% reward", `:56` CTA "Buy LDAT".

That **directly contradicts** `frontend/src/app/terms/page.tsx:211-212`: *"the Services are not deployed for profit generation, investment solicitation, or speculative trading."*

Quality raters and YMYL classifiers judge the **page a user lands on**, not the ToS. An unhedged "1.2x / 20% more ETH / burn pressure" pitch with zero risk language on a brand-new crypto domain is the exact fingerprint Google suppresses hardest. **The contradiction also undercuts the legal posture**, not just SEO: it is hard to argue "not investment solicitation" while the homepage sells a markup. Flag this to whoever owns the Terms.

**Fix.** (1) Add a visible risk line in the homepage mechanics section plus a persistent footer disclaimer linking `/terms`. (2) Resolve the contradiction - either soften the homepage to describe **mechanism** rather than promise **outcome** ("the contract relists at a 20% markup... markup is not a guaranteed return, bags may not sell"), or amend `terms:211-212`. **Do not leave both claims standing.**

**Corrections to the audit's E-E-A-T finding, so you do not do unnecessary work:**
- **"No risk disclosure" is FALSE.** Terms Section 30 "Acknowledgments; assumption of risk" (`terms/page.tsx:667`) is a comprehensive nine-item enumerated disclosure covering smart-contract, liquidity, regulatory, volatility and total-loss risk, and a sitewide blocking `TermsGate` (`layout.tsx:40`) forces acceptance before use. The valid critique is **placement only**: surface a short risk section on `/about` linking Terms Section 30. Do not author risk disclosure from scratch.
- **"Upgrade-key risk undisclosed" is FALSE.** `about/page.tsx:125-129` already discloses it and renders live. That candor is an E-E-A-T **asset** - surface it, do not hide it.
- **"No author identity" is overstated and the fix is misguided.** `/contacts` labels a Founder plus role-specific `legal@`/`security@` addresses. A named human with credentials is **not** required for a pseudonymous DeFi protocol. Verifiable on-chain provenance and a consistent public pseudonymous identity are the correct standard.
- **Genuine remaining gap:** no `/security` page and no audit-status disclosure. The only occurrences of the word "audit" on the entire site are two Terms disclaimers saying you *don't* audit (`terms:333`, `terms:578`). An honest "not yet audited - here are the contracts, the test suite, and the Phase G immutability timeline" outranks silence.

---

### WAVE 5 - Authority and content. Months, not days.

#### W5.1 - CoinGecko. **Only after W0.1 shows LDAT.**

**What.** Check the original ticket for a rejection reply **before** resubmitting.

**Why.** Project memory records the resubmit as "ACTIVE ~2026-06-21". Verified today: `api.coingecko.com/api/v3/search?query=LDAT` returns **0 coins**, and `coingecko_coin_id` is `null`. Three and a half weeks past their stated 5-7 business day SLA. It was rejected, stalled, or never sent - resolve which. **CoinGecko explicitly disqualifies tokens for spammy repeat requests**, so a resubmit on top of an open ticket is actively harmful.

One plausible rejection cause is visible in this audit: CoinGecko requires an official website with clear docs and verified socials, and until Wave 1 ships you have no robots.txt, no sitemap, and docs duplicated across two hosts with no canonical. **W1.1-W1.4 are therefore prerequisites, not parallel work.**

#### W5.2 - DexScreener. Two asks, in order.

**What.** (1) File a **chain/pool indexing request** with support - `api.dexscreener.com/latest/dex/tokens/0x02F289...` returns `{"pairs":null}`, meaning DexScreener has not indexed the Uniswap v4 Linea PoolManager at all. This is total absence, not a metadata gap. Their self-serve form assumes the pair already exists. Root cause is likely the same v4-on-Linea coverage gap that delayed GeckoTerminal: DexScreener's Linea index carries only `dexId` `etherex` and `lynex`, no Uniswap v4. (2) **Only once the pair exists**, consider Enhanced Token Info ($299) for logo/description/socials. Do not pay before (1) resolves.

**Why it matters.** DexScreener is the default price-check reflex for DeFi traders and carries more qualified referral traffic for a small-cap token than all organic Google combined. Competitor AEROSTRAT has a live page there; you have nothing. **AEROSTRAT beats you on exactly one axis, and it is distribution, not SEO** - its own site is a bare Vite SPA titled "Aerostrategy" with no meta description.

#### W5.3 - DefiLlama adapter. Feasible, and a competitor ships the template.

**What.** Fork `DefiLlama/DefiLlama-Adapters`, add `projects/ldat/index.js` modelled on the **merged, live** `projects/iaero/index.js`.

**Why this is the answer to "is DefiLlama feasible", in both directions:**
- **YES via the protocol TVL path.** iAERO is a treasury/locker protocol whose TVL is just "tokens held by our contracts" - structurally identical to LDAT's ETH/bag treasury. Its adapter is a ~40-line file using `sumTokens2`. `api.llama.fi/protocols` confirms `"name":"iAero Protocol", "module":"iaero/index.js"`; neither LDAT nor AEROSTRAT is listed.
- **NO via `defillama.com/digital-asset-treasuries`.** That dashboard is built for public companies with share prices, tickers (MSTR, BMNR) and SEC filings. LDAT has neither. Chasing it burns time despite you owning the "DAT" word. **And that structural exclusion is precisely why the on-chain-vs-public-company distinction is worth owning in content** (W5.5).

**Notes.** Export TVL over the strategy proxy summing ETH treasury + bag holdings, chain key `linea`, start block at launch (2026-06-09). Enable "Allow edits by maintainers". Do **not** touch `pnpm-lock.yaml`/`pnpm-workspace.yaml` (CI breaks). Allow 24h post-merge for the UI. **TVL must be computed from chain data - do not read it from your own indexer API.**

**Caveat:** `docs.llama.fi` publishes process but no explicit eligibility criteria or minimum TVL. My feasibility conclusion is **inferred** from the live iAERO precedent, not from a stated rule. Low risk, but it is an inference.

#### W5.4 - JSON-LD. Four types, no more.

**What.** A shared `src/lib/schema.ts`, rendered from server components. Verified today: `ld+json count: 0` on the homepage; zero `schema.org` references anywhere in `src/`.

**Ship exactly:** `Organization`, `WebSite`, `TechArticle` (docs), `BreadcrumbList` (docs + dats).

**Calibrate expectations honestly.** Of these, **only `BreadcrumbList` produces a documented Google rich result.** `Organization`/`WebSite` are entity/knowledge-graph signals with no SERP change - genuinely valuable here for disambiguating a new, acronym-colliding brand, and for AI grounding, but not for rankings. `TechArticle` yields no visible SERP feature, so **drop the git-mtime-driven `datePublished`/`dateModified` plumbing** the audit proposes - it is effort for zero rich-result payoff.

**Required implementation detail:** `dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }}`. The escape prevents a `</script>` breakout XSS and is not optional. All docs pages are server components (they export `metadata`), so no `'use client'` conflict.

**Three things that would ship it broken:**
1. **The proposed logo URL is a 404.** `https://www.on-chaindat.com/onchaindat-mark-512.png` does not exist (verified). Google **fetches** the logo, so an invalid `ImageObject` is worse than omitting it. Use `/ldat-icon-512.png` (verified 200 today, real 512x512) or `/onchaindat-mark.svg` (SVG **is** supported by Google Images, contrary to a refuted finding - but its `width="80" height="80"` is below Google's 112x112 minimum, so edit the two attributes first).
2. **`sameAs` must contain only real profiles of the org:** `https://github.com/patronny/on-chainDAT`, `https://t.me/onchainDAT`, `https://t.me/onchainDAT_chat` (`contacts/page.tsx:37,45`). **Exclude** `x.com/PaTRoN4egLabs` and `x.com/patron4eg` - `footer.tsx:29` labels the former "Created by", so it is the **creator's** account, and a false `sameAs` pollutes entity resolution. Put it on a separate `founder` node. **Exclude** Lineascan/GeckoTerminal - those are third-party token listings, not profiles of the org. Invent no Discord.
3. **Schema `@id`/`url` must mirror the canonical exactly.** Ship W1.2 first, then use www URLs. Generate breadcrumbs from `docsNav`/`flatDocs` (`src/lib/docs-nav.ts:13-28`) rather than hand-writing, and omit `item` on the final breadcrumb entry per Google guidance.

**Skip `TechArticle` on the three stubs.**

#### W5.5 - llms.txt. After robots + sitemap, not before.

**What.** `frontend/public/llms.txt` - one hand-written static file. `src/middleware.ts:50` excludes dotted paths, so it serves correctly on all hosts.

**Be honest about it.** llms.txt has **no confirmed consumer** at any major AI provider, and Google has publicly likened it to the keywords meta tag. `curl -A "GPTBot" https://www.on-chaindat.com/docs` already returns 200, so nothing is blocked. It is cheap, low-risk insurance, **not** a ranking fix. Its one genuinely valuable payload is the **DAT acronym disambiguation** (W5.6), which does double duty.

**Two hard rules:**
- **Do not ship it before W1.1.** A link index pointing at pages that server-render zero content routes AI crawlers at exactly the pages they cannot read. A link map to unreadable pages is worth approximately nothing.
- **Skip `llms-full.txt`.** Migrating docs to MDX or adding a `scripts/build-llms.mjs` JSX-stripper is a real refactor plus permanent build surface for a 7-page corpus that GPTBot already fetches at 200.

**Do not list `/docs/faq` or `/docs/dat-types/yield`** until they have content. Pointing an AI at an empty page teaches it the site is thin.

**Optional upgrade worth considering:** `bitcointreasuries.net` is the closest analogue to what on-chainDAT should be, and it treats `llms.txt` as a **first-class data product**, embedding live totals ("Total BTC held: 4,187,020 BTC"). You already have the indexer to render live treasury value, burn total and bag count into the file at request time (`src/app/llms.txt/route.ts`). That would make it a data surface rather than a brochure. Defer until the static version proves itself.

---

## 4. Content plan

**Governing principle:** the expensive part of GEO is already done. `docs/page.tsx:10`, `docs/tokenomics/page.tsx:11-14`, `docs/ldat/page.tsx:44`, `docs/new-launches/page.tsx:22-26`, `docs/transfer/page.tsx:65-71` all already lead with standalone extractable definitions and concrete numbers. This is what extractive engines look for and it is better than most crypto sites. **The content is losing on delivery, not substance.** Do not rewrite the docs. Ship them (W1.1), then package them.

**Total content today:** ~2,250 words across 16 routes excluding `/terms`, averaging ~141 words/page. Only `/about` (898 words) has enough depth to compete for anything. `/dats`, `/dats/[address]`, `/portfolio`, `/transfer`, `/status` are app shells (0-2 words) that will never rank. **Stop counting them as content.**

### Pillar and spoke

```
PILLAR: /docs/what-is-an-onchain-dat   [NEW - the semantic land-grab]
   |
   +-- /docs/dat-types                 [EXISTS, empty -> fill: hub intro only]
   |     +-- /docs/dat-types/classic   [EXISTS, 76 words -> expand]
   |     +-- /docs/dat-types/yield     [EXISTS, empty -> write or unpublish]
   |
   +-- /docs/why-dats-trade-below-nav  [NEW - contrarian hook + mNAV section]
   +-- /docs/faq                       [EXISTS, empty -> the highest-value fill]
   +-- /docs/ldat                      [EXISTS -> the brand implementation]
   +-- /docs/tokenomics                [EXISTS -> the burn/fee mechanics]
   +-- /docs/new-launches              [EXISTS -> launch mechanics]
   +-- /docs/transfer                  [EXISTS -> relay + 1% burn]
   |
   +-- /docs/v4-hook-buy-and-burn      [NEW - developer niche, link-earner]
   |
   +-- /docs/glossary                  [NEW - defines bag, markup, keeper, slow-rug]
   |
   -> converts down to /dats/0x02F289...cFC5
```

### The three new pages, in priority order

**1. `/docs/what-is-an-onchain-dat` - the land-grab. Build this first.**

- **Target query:** "on-chain DAT", "onchain digital asset treasury", "protocol-native DAT". **Not** "digital asset treasury".
- **Intent:** informational, definition-seeking, disambiguation.
- **Title:** "What Is an On-Chain DAT? Protocol-Native Treasuries vs Tokenized DAT Equity"
- **Format:** a **taxonomy, not a pitch**. Name and fairly describe all three meanings: (1) DAT company / DATCO (Strategy, BitMine - shares, dilution, SEC filings), (2) tokenized DAT equity (Injective SBET - still a company, just wrapped), (3) protocol-native DAT (no company, no shares, the treasury **is** the contract). Comparison table on dilution / custody / NAV verifiability / who can stop it.
- **Critical rule:** **do not claim "first".** Injective already burned that word with news-wire amplification. Re-claiming it invites correction and destroys citability. Be honest that category 3 is new and LDAT is an example of it.
- **Job:** be the citation source when someone asks an LLM "what is an on-chain DAT". Not to rank for volume.
- **Also:** link OUT to The Block and CNBC as references. Outbound citation to incumbents costs nothing and makes the page **more** citable, because extractive engines reward pages that situate themselves in a landscape.

**2. `/docs/why-dats-trade-below-nav` - the contrarian hook.**

- **Target query:** "DAT discount to NAV", "why do DAT stocks trade below NAV", "mNAV crypto treasury"
- **Intent:** informational, comparison-seeking, narrative-aware reader
- **Title:** "Why DAT Companies Trade Below NAV (And What an On-Chain Treasury Changes)"
- **Format:** lead with the incumbents' own numbers (Bloomberg 2026-02-05: median **-62%** over the past year; the mNAV "hall of mirrors" where the same stock reads as a 90% discount or a 500% premium depending on share-count method). Diagnose the two causes (dilution mechanics, unverifiable NAV accounting). Show the on-chain contrast with a live contract link and a verifiable treasury readout.
- **Include a nested section: "mNAV for a treasury with no shares."** Every incumbent definition (DefiLlama's own methodology, DATFLOW, DL News) divides by a **share count a smart-contract treasury does not have**. That is a genuine unanswered question the incumbents structurally cannot answer. Show the substitution (circulating supply for FD shares, contract-read treasury value for filed treasury value). **Cite DefiLlama's methodology explicitly as the baseline being adapted** - that framing is what makes it citable. Do **not** give this its own URL; it is a crack, not a cluster.
- **Critical rule:** this must be **analysis, not a shill piece**, or it fails as both SEO and AI citation. Include the honest counterpoint: a micro-cap on-chain treasury has its own risks - liquidity, smart-contract risk, no regulatory recourse.
- **Distribution:** X/Twitter, where this cluster's audience actually lives. Treat Google as a bonus.

**3. `/docs/v4-hook-buy-and-burn` - the developer niche.**

- **Target query:** "Uniswap v4 hook buy and burn", "v4 hook deflationary token"
- **Intent:** developer/technical research
- **Title:** "Implementing Buy-and-Burn in a Uniswap v4 Hook (Live on Linea)"
- **Format:** engineering write-up with real code and a real deployed address. Which hook callbacks fire; how the drip/accumulate threshold is set (**0.005 ETH/block `buyIncrement`, immutable, set in `initialize` with no setter** - a concrete, unusual, publishable detail); why exact-input vs exact-output mattered against the Etherex router; what reverts in practice.
- **Do NOT write another "what are hooks" intro.** Link to `docs.uniswap.org` and start at the interesting part. The generic cluster is owned by Uniswap's own docs plus every crypto-education mill. The only project-specific precedent I found is $UORE via PANews. This is thinly covered.
- **Volume:** tiny. **Visitor quality:** the highest on the site. This is the most **credible** page the project can write, since it ships a real v4 hook in production.
- **Distribution:** cross-post to Medium/Coinmonks and Mirror. This earns citations, not rankings.

### Packaging changes to existing docs (all cheap, all post-W1.1)

1. **Add `<h2>` subheadings in question form.** `grep -c '<h2'` across `src/app/docs/*/page.tsx` finds **none**. A wall of `<p>` under one `<h1>` gives an engine no seams to extract on.
2. **Keep the definition-first pattern** - every `<h2>` followed by a sentence that stands alone without its heading. `docs/page.tsx:10` is the model.
3. **Convert fee splits to `<table>`.** `docs/ldat:49-58` and `docs/dat-types/classic:19-31` are tabular data currently in `<ul>`. Tables parse as structured facts and get quoted more reliably.
4. **Replace `$XXXDAT` placeholder notation with a concrete worked example alongside it.** AI retrieval fetches **single pages**, not sites. A model reading `/docs/tokenomics` in isolation will not infer your templating convention and **may quote "XXXDAT" as a real ticker.**
5. **Name the entity and chain once per page** ($LDAT, Linea L2, chain 59144) rather than relying on the reader having read `/docs` first. Same reason.
6. **Use "DAT token" (never bare "DAT") as the head term throughout.** Note `/about:13-16` currently says bare "DAT" and exhibits the exact collision this fixes.

**Do NOT add in-prose internal links as a fix** - `docs-nav.ts:13-28` + `docs-shell.tsx:140-162,172-193,220-283` already render a complete sidebar, prev/next adjacency and child-section cards as real `next/link` elements. They reach zero HTML solely because of the SSR bug. W1.1 restores the entire link graph with no markup change.

### Deferred: `/updates`

A dated post surface (`Article` JSON-LD + RSS, back-filled from the 2,326-line work log: launch retrospective, the ENOSPC indexer incident, the RPC failover, the rename) is a genuine Phase F go-to-market asset and the cheapest E-E-A-T available, since the events already happen. **But it is low severity and last in line.** It is opportunity cost, not a defect; no existing surface is broken. Its value is entirely contingent on **sustained cadence**, and a stalled blog is worse than none. It also needs new tooling (no MDX/feed deps installed) - scope it as plain TSX pages, not a contentlayer build. A monthly treasury/burn report at a stable URL is enough.

---

## 5. Measurement

### Instrument first (Wave 2)

- GSC **domain property** via DNS TXT (one property covers apex + www + docs).
- Bing Webmaster imported from GSC.
- GA4 is already live (G-FE3G03SSJ8, Consent Mode v2). **Note it undercounts:** the consent banner is opt-in, so organic sessions will be understated. Use **GSC clicks as ground truth for organic**, GA4 for behavior.

### Leading indicators (weeks 1-8) - these move before traffic does

| Metric | Source | Today | Target |
|---|---|---|---|
| Pages indexed | GSC Coverage | ~0 | 14 by week 6 |
| Sitemap "Discovered/Read" | GSC Sitemaps | n/a | Read within 72h |
| Crawl requests/day | GSC Crawl Stats | ~0 | >20/day sustained |
| Server-rendered h1 count on `/about` | `curl \| grep -o '<h1' \| wc -l` | **0** | **1** |
| Server-rendered anchors on `/` | `curl \| grep -o '<a ' \| wc -l` | **0** | **>=20** |
| Canonical present on `docs.on-chaindat.com/faq` | curl | **0** | www URL |
| `lineastr.vercel.app/` status | curl | **200** | **308** |
| GeckoTerminal symbol | GT API | **LINEADAT** | **LDAT** |
| Common Crawl captures | CC index API | **0** | >0 by next crawl |

### Lagging indicators (months 3-12)

| Metric | Source | Note |
|---|---|---|
| Brand impressions ("on-chaindat", "LDAT Linea", "LDAT token") | GSC Queries | **The primary KPI.** Currently zero. |
| Docs long-tail impressions | GSC, filter `/docs/` | Second KPI |
| Referral sessions from geckoterminal / dexscreener / coingecko / defillama / linea.build | GA4 Acquisition | **Will dwarf organic. Track it as the real number.** |
| Direct sessions | GA4 | Proxy for X/Telegram distribution working |
| AI citation | Manual monthly: ask ChatGPT/Perplexity/Claude "what is an on-chain DAT" and "what is LDAT on Linea" | No API. Log verbatim answers monthly. This is the honest way to measure the #2 channel. |

**Do NOT track:** text-to-HTML ratio (not a ranking factor and "fixable" by moving inline JS to an external file with zero benefit), keyword rankings for category terms (you will not have any), Lighthouse SEO score (it reports 100 today **because it evaluates the post-JS DOM** - it is blind to the exact defect that is killing the site, which is the single best illustration of why lab tools are not the ground truth here).

### CI regression guard

```bash
# fails the build if the ssr:false boundary is ever reintroduced
for u in / /about /docs/ldat; do
  n=$(curl -sL "https://www.on-chaindat.com$u" | grep -o '<h1' | wc -l)
  [ "$n" -ge 1 ] || { echo "SSR regression on $u"; exit 1; }
done
chars=$(curl -sL https://www.on-chaindat.com/docs/ldat | python3 -c "
import sys,re;h=sys.stdin.read()
t=re.sub(r'(?is)<script.*?</script>|<style.*?</style>|<template.*?</template>','',h)
t=re.sub(r'<[^>]+>',' ',t);print(len(' '.join(t.split())))")
test "$chars" -gt 1000 || { echo "SSR regression: only $chars chars"; exit 1; }
```

Note: strip `<style>` and `<template>` as well as `<script>`. There are 0 inline style blocks today, but inlined critical CSS after any future change would count as visible text and produce a **false PASS**. And never use `grep -c '<h1'` - Next serves the document on one line, so it counts lines and can never exceed 1: it would silently pass a page with three h1s.

### Realistic expectations

| Horizon | Organic (GSC clicks/mo) | What is actually happening |
|---|---|---|
| **Month 3** | **20-60** | Indexation exists. Brand queries resolve to the site instead of Barco's projector tool. Aggregator referral is 10-30x this number. This is the point where "does the site exist to Google" flips from no to yes. |
| **Month 6** | **80-200** | Docs long-tail starts. AI citation begins **if and only if** the pillar page and FAQ shipped. Referral still dominates. |
| **Month 12** | **200-500** | Ceiling, and only with the content plan executed and sustained. Category terms remain at ~0 regardless. |

**If you only read one line of this section:** referral from aggregators will exceed organic by 10x-50x for the entire period. Budget attention accordingly. Organic is the third-most-important channel and it is worth fixing mainly because the fixes (W1.1) are also what makes the AI channel and the social channel work.

---

## 6. Kill list: do not spend a single hour on these

**Content fantasies**

1. **A "what is a digital asset treasury" explainer.** The SERP is CNBC, The Block (`/learn/390761`), DACFP, Halborn, Cherry Bekaert, Bitwave, Zodia, XBTO, ARK, IBKR Campus. **Zero small sites in the top-10 across two separate searches.** These are decided by domain authority and journalistic entity signals. You will not crack the top 50 on the merits of a competing explainer, ever. Put DAT background as a **section inside** the pillar page and link out to the incumbents.
2. **A standalone "what is mNAV" page.** DefiLlama literally publishes the industry methodology (`docs.llama.fi/analysts/dat-methodology`), syndicated to DL News, Yahoo Finance, BNC Times. Lost. Take the crack (the no-shares substitution), not the cluster.
3. **A "Top Linea DeFi Projects" listicle.** That SERP is **100% third-party listicles** (DefiLlama, Bitget Academy, BingX Learn, TokenMetrics, CoinGape). Zero project-owned sites rank. You do not rank for "top Linea projects" by writing your own listicle - you rank by being **in** someone else's, and inclusion is gated on market cap and TVL thresholds you do not meet. **Reclassify this from SEO to distribution** (W5.3, W0.4).
4. **Any transactional token query.** Decided by market cap and aggregator presence.
5. **Pages targeting "P2P bag mechanism" or "slow-rug protection".** Plausibly zero searches worldwide. Nobody but this project uses the strings.
6. **"Expand the homepage to 400-600 words."** Unsupported boilerplate. `/` is a dapp landing page. Do not pressure filler content to hit a word count.
7. **A blog CMS.** Static TSX pages in the existing docs shell. No contentlayer, no MDX pipeline.

**Schema fantasies**

8. **`FAQPage` expecting rich results.** Restricted to government and health sites since **August 2023**. It will produce no SERP accordion. Value is LLM parsing only. Ship it, but for the right reason.
9. **`WebSite.potentialAction` / SearchAction.** Google retired the Sitelinks Searchbox rich result in **Nov 2024**, and you have no search results URL to point at anyway - `docs-search.tsx:20,27` is an in-memory modal over a hand-curated static array (`docs-search.ts:17`) that `router.push`es straight to a page. There is no `/search` route and zero `searchParams` usage in `src/app`. **Do not build one to justify schema.**
10. **`FinancialProduct` / `InvestmentOrDeposit`.** No Google rich result exists. Zero SERP upside, and typing a permissionless experimental token as a regulated-sounding financial product contradicts your own disclaimer (`footer.tsx:100`) and TermsGate.
11. **`Product` + `Offer` on the token page.** A live Uniswap v4 spot price is a **market quote, not an Offer** - no seller, no fixed price, no availability. `offers.price` would misdescribe it. Google penalises markup that does not correspond to visible content.
12. **`SoftwareApplication` with a fabricated `aggregateRating`.** The rich result requires `aggregateRating` or `review`; you have no legitimate rating source (`grep` confirms none). Manufacturing one is a straight self-serving-review spam violation. (Note: the type is **not** barren - Google still documents the software app rich result. It is ineligible **here** specifically. A bare `WebApplication` with no ratings and no offers is honest and fine as an optional GEO extra.)
13. **`TechArticle` date plumbing driven by git mtime.** No SERP change. Effort for zero rich-result payoff.

**Engineering fantasies**

14. **`cookieStorage` as a fix for the indexedDB prerender crash.** It replaces wagmi's **own** storage (default localStorage, already noop-guarded on the server when `ssr: true`). It never touches WalletConnect, which is the only place `indexedDB` appears in the tree. It is hydration polish, orthogonal to SSR output, and attempting it first wastes a cycle. **Moot anyway** - the crash no longer reproduces (section 2.1).
15. **Pushing the `ssr:false` boundary down to 7 leaf components.** Unnecessary. The build succeeds with the boundary deleted entirely. This was the audit's consensus "primary fix" and it is a day of work solving a problem that no longer exists.
16. **`llms-full.txt` with an MDX migration or a JSX-stripping build script.** Permanent build surface for a 7-page corpus GPTBot already fetches at 200, consumed by nothing confirmed.
17. **`/dats/ldat` readable slugs + a permanent middleware 301.** Speculative architecture for a **one-DAT** site. It permanently penalizes the explorer and external links, and violates the project's minimalism rule. Keep the address URL canonical until DAT #2 exists.
18. **`Disallow: /api/` as "defense in depth" alongside `X-Robots-Tag: noindex`.** These are **mutually exclusive, not additive** - a disallowed URL is never fetched, so the noindex header is never read. Also note `/api/supply/total` and `/api/supply/circulating` are the CMC/CoinGecko supply endpoints; a blanket disallow is harmless only because those fetchers ignore robots.txt. There are no `href`s to `/api/` anywhere in `src/`, so there is no crawl path to begin with.
19. **Removing `document.body.style.overflow = "hidden"` from TermsGate for SEO**, or rendering the gate non-modal for crawlers. The first does nothing (what covers content is the `fixed inset-0` backdrop at `terms-gate.tsx:78`, not the scroll lock) and would let users scroll content they cannot click. **The second is user-agent cloaking - a direct spam-policy violation** that trades a phantom risk for a real manual-action risk. The overlay is a DOM sibling that occludes pixels, not nodes; content behind it is neither `display:none` nor `visibility:hidden`, so WRS extracts it at full weight. Google's intrusive-interstitial guidance **explicitly exempts** interstitials responding to a legal obligation, which is exactly what `terms-gate.tsx:92-101` is. And `terms-gate.tsx:23,26,32-33` already exempts `/terms`, `/docs/*` and `docs.*`.
20. **`productionBrowserSourceMaps`.** The failing `valid-source-maps` Lighthouse audit carries **weight 0** in the best-practices category - it can never move the score (hence 100 despite the FAIL). The flagged chunk is lazily loaded and off the critical path. Zero crawler, ranking or user impact. Fine to adopt for readable production traces; that is a DX backlog item, not SEO.
21. **Security headers as an SEO item.** Missing `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` have **zero** ranking, crawl or indexation impact. **Refile as security** - and there `X-Frame-Options` is genuinely worth shipping, because `swap-card.tsx`/`transfer-card.tsx`/`actions-card.tsx` all call `useWriteContract`, making this a live wallet-signing surface with no framing protection. No Safe App connector exists, so `SAMEORIGIN` breaks nothing. **Drop `preload` from the HSTS line** - it is a one-way door compiled into browser binaries, and HSTS should be strengthened in Vercel's domain settings rather than duplicated into `next.config.mjs` as a competing source of truth.
22. **The `binary-rain` canvas.** Measured at **0.136 ms/frame** at dpr 2, **zero long tasks** across 180 consecutive frames, locked 60 fps, and non-monotonic with DPR (dpr 1 measured *slower* than dpr 2, because the fill is a GPU-side blend). It is `absolute inset-0` so it cannot cause CLS and is not the LCP element. The 9.5s mobile LCP is the **web3 stack** (2,104 KB decoded JS across 37 scripts), not the canvas. And the proposed `pointer: coarse` guard would blank the brand texture on all touch devices including touch laptops.
23. **The font cascade cleanup, as prescribed.** `globals.css:42-44` does override next/font with unloaded families, and the 48 KB Inter woff2 is preloaded and never painted - that half is real. But **`--font-mono` is NOT broken** (JetBrains Mono reports "loaded" and is rendering; keep its preload), and **deleting lines 42-44 is the highest-risk option, not the simplest**: it would restyle every h1 from browser-default monospace to Inter and all body copy from system-ui to Inter, silently changing a design that memory records as **locked and verified at 320/375/768/1024/1440px**. The zero-visual-change fix is to delete only the Inter import at `layout.tsx:10` and `${inter.variable}` from the `<html>` className. Cosmetic either way; low priority.

**Off-site fantasies**

24. **Buying links, guest-post networks, any link scheme.** In this exact vertical this is the one move that converts "invisible" (fully recoverable) into "penalized" (much harder). **The current state is genuinely clean. Protect that.** It is an asset.
25. **Fighting Barco for "LDAT".** They own a trademarked hardware product. Concede it. **Always co-occur the disambiguators** - "LDAT" + "Linea" + "on-chainDAT" in titles and H1s, never "LDAT" alone. The homepage title already does this correctly. Keep the Linea qualifier permanently.
26. **Reddit/forum posting for SEO.** Can help distribution. The links are nofollow and often stripped. Do not count it as link building.
27. **IndexNow.** Solves a **freshness** problem you do not have. You have a **discovery** problem.
28. **`defillama.com/digital-asset-treasuries`.** Structurally cannot include you - it needs share prices and SEC filings. Use the **protocol TVL** path (W5.3).

---

## 7. Merge map: 47 findings to 14 work items

| Work item | Absorbs |
|---|---|
| **W1.1** SSR bailout | `ssr-false-providers-empties-entire-site`, `zero-crawlable-anchors-sitewide`, `no-h1-in-server-html`, `text-to-html-ratio-near-zero`, `zero-ssr-empty-shell-sitewide`, `zero-ssr-content-ai-crawlers-see-nothing`, `zero-ssr-html-bailout`, `csr-bailout-destroys-link-graph`, + the root cause of `mobile-perf-27-web3-on-every-route` and `docs-page-ships-walletconnect` |
| **W1.2** Canonical (1 line) | `zero-canonical-sitewide`, `no-canonical-tags`, `no-canonical-plus-docs-subdomain-duplication` (x2), `docs-subdomain-duplicate`, `docs-dual-host-no-canonical`, `docs-duplicate-hosts-no-canonical`, `docs-subdomain-duplicate-no-canonical`, `docs-duplicate-content-two-hostnames-no-canonical`, `docs-subdomain-vs-subfolder`, canonical half of `missing-canonical-and-og-image` |
| **W1.3** robots + sitemap | `robots-txt-missing`, `sitemap-missing`, `robots-sitemap-llms-404`, `robots-txt-missing-no-sitemap-directive`, `no-sitemap-no-robots-no-discovery`, `zero-indexation-crawl-blockers`, `zero-indexation-infrastructure`, `no-robots-no-sitemap-worse-than-smallest-competitor` |
| **W1.4 / W2.3** Host cleanup | `vercel-alias-indexable-duplicate`, `live-indexable-duplicate-site`, `apex-307-not-308`, `middleware-redirect-307-not-308`, `middleware-307-not-308` |
| **W2.1** GSC/Bing | `no-search-console-no-bing` |
| **W3.1-W3.3** Metadata | `inherited-default-title-desc-4-routes`, `about-page-no-metadata`, `duplicate-titles-money-page-no-metadata`, `docs-index-title-unbranded`, `docs-descriptions-all-identical`, `docs-duplicate-meta-descriptions`, `root-description-truncates`, `utility-routes-indexable`, `missing-meta-descriptions`, `docs-metadata-defects` |
| **W3.4** /dats gate | `dats-address-index-bloat`, `dats-address-slug-index-bloat`, `dats-address-infinite-thin-pages`, `dats-detail-unreachable-router-push` |
| **W3.5** OG image | `no-og-image-sitewide`, `og-title-static-sitewide`, og half of `missing-canonical-and-og-image` |
| **W3.6 / W4.4** Positioning + YMYL | `invented-terminology-wasting-meta`, `homepage-h1-no-brand-no-entity`, `eeat-absent-ymyl-financial`, `ymyl-homepage-no-risk-disclosure` |
| **W4.1** Docs stubs | `docs-stub-pages-thin-content`, `published-empty-stub-pages`, `faq-and-dat-types-are-empty-stubs`, `faq-page-empty-blocks-faqpage` |
| **W4.2-W4.3** Truth | `stale-content-contradicts-live-product`, `fee-split-inconsistency-across-pages`, `stale-future-tense-docs-contradict-live-reality` |
| **W5.4** JSON-LD | `zero-jsonld-sitewide`, `no-structured-data` (x2), `no-searchaction`, `no-financialproduct-or-softwareapplication` |
| **W5.5** llms.txt | `llms-txt-missing` (x2), `no-llms-txt-geo-gap`, `no-llms-txt-ai-search`, `geo-ai-citation-primary-channel` |
| **W0 / W5.1-W5.3** Off-site | `geckoterminal-stale-ticker-blocks-ldat-discovery`, `geckoterminal-stale-brand-metadata`, `coingecko-resubmit-has-not-landed`, `dexscreener-completely-absent`, `defillama-listing-is-feasible-iaero-proves-it`, `linea-hub-unsubmitted-assets-ready`, `github-backlink-points-to-wrong-host`, `no-backlinks-no-wayback-no-commoncrawl`, `brand-navigational-collision`, `unverified-social-presence`, `linea-ecosystem-cluster-is-pr-not-seo` |
| **§4** Content | `onchain-dat-semantic-collision`, `dat-acronym-collision`, `dat-discount-contrarian-angle`, `mnav-onchain-verification-longtail`, `uniswap-v4-hook-dev-niche`, `no-pillar-page-hub-and-spoke`, `docs-citability-strong-content-wrong-container`, `thin-content-sitewide`, `no-blog-or-changelog-surface`, `no-blog-glossary-content-surface` |
| **§6** Killed / refiled | `dat-head-terms-unwinnable`, `missing-security-headers` (-> security), `missing-source-maps` (-> DX), `font-cascade-broken-wasted-inter` (-> cosmetic), `missing-preconnect-third-parties` (refuted), `binary-rain-uncapped-dpr` (refuted), `terms-gate-interstitial-overlay` (refuted), `api-routes-no-robots-header` (refuted), `orphan-pages-footer-only` (refuted), `org-logo-not-rich-result-eligible` (refuted), `brand-entity-unknown-to-ai` (refuted) |

---

## 8. Corrections to project memory

Three memory entries are stale; two are materially wrong. Fix these or the next session repeats the error.

1. **`project_dexscreener_v4_linea` says "GeckoTerminal indexes v4-on-Linea (LINEADAT chart live)".** True but misleading. It indexes the token under the **dead** name. Searching "LDAT" on GT returns zero. Memory reads as "done"; it is not.
2. **Same entry: "CoinGecko ACTIVE resubmit ~2026-06-21".** The CoinGecko search API returns empty 3.5 weeks later. Rejected, stalled, or never sent. **Check the ticket before resubmitting** - CoinGecko disqualifies tokens for spammy repeat requests.
3. **`project_ldat_logo` "TODO: re-shoot Hub + resubmit, caches refresh"** is the **same root cause** as #1: the 2026-06-20 on-chain rename was never propagated to external surfaces. Treat it as **one coordinated cleanup**, not scattered TODOs.
4. **`project_transfer_relay` notes "wagmi FALLBACK_STRATEGY 0x615937AE is dead, live LDAT=0x02F289...cFC5"** - still accurate, worth keeping.

---

## The one-afternoon version

If nothing else gets done:

1. GeckoTerminal rename form. **20 min.** Closing window. (W0.1)
2. GitHub repo homepage -> www. **5 min.** (W0.2)
3. Delete `ssr:false` from `providers.tsx`. **3 lines.** Build is proven; smoke-test the wallet. (W1.1)
4. Add `alternates: { canonical: "./" }` to `layout.tsx`. **1 line.** (W1.2)
5. Add `robots.ts` + `sitemap.ts`. **20 min.** (W1.3)
6. Set `lineastr.vercel.app` to 308. **5 min.** (W1.4)
7. Verify GSC via DNS TXT, submit sitemap. **30 min.** (W2.1)

That is roughly **4 hours of work and about 30 lines of code**, and it is the entire difference between a site that is invisible by construction and one that is in the index. Everything else in this report is optimization on top of it.