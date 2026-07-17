# SEO, content, analytics

Purpose: make www.on-chaindat.com discoverable and truthful to search
engines, AI crawlers and social unfurlers, and measure what happens - the
discovery surfaces (canonical, robots, sitemap, OG card, JSON-LD, llms.txt,
IndexNow), the content-truth rules from the 2026-07 W0-W5 program, and the
GA4/consent stack. Read `docs/ARCHITECTURE.md` first for the four planes.
Shares files with `docs/subsystems/frontend-app.md` (the SSR rule and shell
live there); audit, kill list and backlog live in `docs/90-seo-roadmap.md`.

## How it works

1. **Everything rides on SSR.** Until 2026-07-15 an ssr:false boundary made
   every route serve an empty shell (~15-40 chars, zero anchors, zero h1).
   Googlebot renders JS, so it shipped unnoticed; AI crawlers and unfurlers
   saw only a title, and GSC read /about as "URL is unknown to Google".
   Deleting that boundary (W1.1) is the root fix everything below rides on.
2. **Canonical and hosts.** `frontend/src/app/layout.tsx` sets metadataBase
   plus alternates.canonical "./", resolved per-route against the REQUEST
   path - not, as the audit claimed, the middleware-rewritten one; shipped
   as written it would have canonicalized every docs-subdomain page to a
   dead www URL (caught only by curl). Duplicate hosts die by instruction
   instead: the docs subdomain [inv: docs-subdomain-308-not-rewrite] and
   the lineastr.vercel.app alias both 308 to www. The apex stays 307
   deliberately - 308s cache irreversibly, and there is a rename history.
3. **robots + sitemap.** `frontend/src/app/robots.ts` allows /api on
   purpose (/api/supply/* are the aggregator supply endpoints; nothing
   links to /api/). `frontend/src/app/sitemap.ts` (16 URLs) hardcodes the
   prod host and LDAT address (ADDR.strategy would publish the dead Base
   Sepolia fallback if the env were unset [inv: vercel-env-overrides]),
   omits the noindex routes (yield, /portfolio, /status) and skips
   lastModified (a per-deploy stamp devalues the signal).
4. **IndexNow** (`.github/workflows/indexnow.yml` running
   `.github/scripts/indexnow.mjs` on pushes touching `frontend/src/app/` or
   `frontend/public/` - a components-only edit does not trigger it) pings
   Bing/Yandex; Google does not participate and gets the URLs via the GSC
   sitemap. The script reads the LIVE sitemap - a ping can never claim a
   URL prod does not serve - and retries once on 403/404 (key file lagging
   the CDN edge). The key is public by design [inv: indexnow-key-immutable].
5. **GSC + Bing.** GSC domain property sc-domain:on-chaindat.com, verified
   via a GoDaddy DNS TXT added with PATCH append, never PUT (PUT replaces
   all TXT at the name; it would have wiped the Proton SPF). The claude-seo
   SA (key under ~/.config/claude-seo/, external) reads Search Analytics
   and URL Inspection; request-indexing has no API and runs via a copied
   Chrome profile over CDP. Bing (it feeds ChatGPT search) was imported
   from GSC 2026-07-16; the import dropped the sitemap, resubmitted by hand.
6. **Share and AI surfaces.** `frontend/src/app/opengraph-image.tsx` is a
   build-time satori card (1200x630, summary_large_image; shares used to
   unfurl as grey text stubs). The root layout deliberately does NOT set
   openGraph.title/description - explicit root values suppress Next's
   per-page og backfill. `frontend/src/components/json-ld.tsx` ships
   Organization + WebSite plus a 14-item FAQPage mirroring
   `frontend/src/app/docs/faq/page.tsx`, and
   `frontend/src/components/docs-breadcrumb-jsonld.tsx` derives
   BreadcrumbList from `frontend/src/lib/docs-nav.ts`; every value must
   already be true and visible on the live site. `frontend/public/llms.txt`
   mirrors the sitemap URL set; risk state travels with the mechanics.
7. **The pillar and the fact-check discipline.**
   `frontend/src/app/docs/what-is-an-onchain-dat/page.tsx` disambiguates
   the contested term (DAT company vs tokenized DAT equity vs
   protocol-native DAT, plus synthetic perp exposure; never claims
   "first"). Its two edit rules now govern all content: every third-party
   claim carries a linked source, and every LDAT claim is scoped to what
   the current code does. Its fact-checkers caught two FALSE claims live:
   the 1.2x multiplier called owner-adjustable (setPriceMultiplier is
   onlyFactory, no factory path - upgrade only) and "no whitelist"
   (isDistributor gates transfers, not the fee
   [inv: transfers-distributor-gated]); an earlier pass had fixed the fee
   number itself (8% treasury / 2% project, not 10) on the two most-read pages.
8. **YMYL constraint.** `frontend/src/app/page.tsx` and
   `frontend/src/app/about/page.tsx` describe present-tense mechanism only,
   never a favorable outcome - the homepage once sold "1.2x / Buy LDAT"
   while /terms states the Services are not for profit generation; resolved
   toward the Terms (owner's call). Risk copy stays next to the CTA.
9. **Analytics.** `frontend/src/components/google-analytics.tsx` loads GA4
   G-FE3G03SSJ8 (property 544432985, PaTRoNLABS account) with Consent Mode
   v2 defaulting everything denied (cookieless);
   `frontend/src/components/cookie-consent.tsx` can grant analytics_storage
   only, shared via `frontend/src/lib/consent.ts`. GA undercounts by
   design: GSC clicks are the organic ground truth, GA4 is for behavior.
10. **Strategy.** Realistic organic ceiling ~200-500 clicks/mo at month 12,
    nearly all brand/navigational; aggregator referral beats organic
    10-50x, so listings come first: GeckoTerminal rename (submitted
    2026-07-15; must show LDAT before any CoinGecko attempt or the dead
    name freezes downstream), Linea Hub, DefiLlama protocol-TVL adapter.
    Backlog in `docs/90-seo-roadmap.md`; history in the obsidian work log.

## Owns

`frontend/src/app/robots.ts`, `frontend/src/app/sitemap.ts`,
`frontend/src/app/opengraph-image.tsx`, `frontend/public/llms.txt`,
`frontend/public/8152797bdb756f9c95f5ad2505b1a19b.txt`,
`.github/workflows/indexnow.yml`, `.github/scripts/indexnow.mjs`,
`frontend/src/components/json-ld.tsx`, `frontend/src/components/docs-breadcrumb-jsonld.tsx`,
`frontend/src/components/google-analytics.tsx`,
`frontend/src/components/cookie-consent.tsx`, `frontend/src/lib/consent.ts`,
`frontend/src/app/docs/what-is-an-onchain-dat/page.tsx`, `docs/90-seo-roadmap.md`.
Files also listed by `docs/subsystems/frontend-app.md`
are shared: it owns them as shell chrome, this doc their SEO/analytics side.

## Local invariants

[inv: indexnow-key-immutable] - marker home is the KEY const in
`.github/scripts/indexnow.mjs`. Reads [inv: docs-subdomain-308-not-rewrite],
[inv: vercel-env-overrides], [inv: transfers-distributor-gated],
[inv: no-em-dash], [inv: repo-english-only] as context.

## Verify

- SSR: `curl -sL https://www.on-chaindat.com/about | grep -o '<h1' | wc -l`
  gives >= 1 (never `grep -c` - Next serves one line, so it caps at 1).
- `curl -sL https://www.on-chaindat.com/sitemap.xml | grep -o '<loc>' | wc -l`
  gives 16; robots.txt serves 200 with the Sitemap pointer; canonical on
  /docs/faq is the same www /docs/faq URL (always verify by curl, per the
  point 2 scar).
- `INDEXNOW_DRY=1 node .github/scripts/indexnow.mjs` prints the live URL
  set; the key file URL returns 200 with the key as its body.
- Homepage source: og:image present, the ld+json blocks parse, and the
  consent-default script (all denied) precedes the gtag.js loader.
- GSC URL Inspection (claude-seo SA) says "Submitted and indexed" for /,
  /about, /docs/ldat; Bing shows the sitemap Success with 0 errors.

## Gotchas

- Never click "Generate API Key" on Bing's IndexNow page - it replaces the
  hosted key and resets Bing's trust [inv: indexnow-key-immutable].
- GSC request-indexing quota exhausts silently (failed attempts seem to
  consume it); the only reliable success signal is the button renaming
  REQUEST INDEXING -> REQUEST AGAIN, not any dialog text.
- The indexedDB ReferenceError during next build prerender is caught inside
  WalletConnect - noise, not a failure; never restore ssr:false to fix it.
- Grepping the repo for banned strings is not verification: "Perpetual"
  survived in og:image:alt (case-sensitive grep). Check live prod HTML.
- The FAQPage JSON-LD duplicates the FAQ prose by hand; editing an answer
  without its mirror ships a schema that contradicts the visible page.
- Long literals (addresses, URL examples) overflow 320px viewports; every
  content change re-runs the five-width pass
  [inv: theme-lock-responsive-matrix].
- External listing copy rots independently of the site: the canned
  GeckoTerminal description claimed "non-transferable by design" weeks after
  /transfer shipped. Re-check the local brand/listings text before submitting.
