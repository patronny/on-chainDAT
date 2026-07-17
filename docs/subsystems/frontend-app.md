# Frontend app shell

Purpose: the Next.js 15 App Router application serving www.on-chaindat.com -
the route tree, the docs subdomain redirect, the wagmi/react-query provider
stack, the locked theme, the consent/analytics chrome, and the rule that
every route must server-render real content. Read `docs/ARCHITECTURE.md`
first for the four planes; this doc covers the shell around the data plane.
The snapshot route, same-origin proxies, and indexer client are owned by
`docs/subsystems/indexer.md` and appear here only as things the shell uses.

## How it works

1. **Route map** (`frontend/src/app/`). Server-component pages: `/` (the
   pitch; copy rule in `frontend/src/app/page.tsx` header: present-tense
   mechanism only, never a promised outcome - the YMYL fix that unblocked
   indexing), /about, /contacts, /terms, /transfer, /portfolio, /dats,
   /dats/[address], and the /docs tree (10 pages under a shared
   `frontend/src/app/docs/layout.tsx`). `frontend/src/app/status/page.tsx`
   is a client component, so its metadata lives in
   `frontend/src/app/status/layout.tsx` (Next forbids metadata exports from
   client components). /portfolio and /status are noindex,follow. API
   routes under `frontend/src/app/api/` belong to the data plane.
2. **Per-DAT launch UI.** There is no global /launch route; a launch
   surfaces on /dats/[address]. `frontend/src/components/chart-or-countdown.tsx`
   reads hook.deploymentTime via `frontend/src/hooks/useSnapshot.ts` and
   ticks a 1s clock: pending/failed read or a future timestamp renders
   `frontend/src/components/launch-countdown.tsx`; past renders
   `frontend/src/components/gecko-chart.tsx`, a GeckoTerminal iframe
   addressed by the runtime POOL_ID [inv: pool-id-derived-at-runtime]. It
   never silently degrades to the chart on a transient RPC failure. The
   indexer-fed `frontend/src/components/price-chart.tsx` stays in the tree
   unmounted, its [inv: chart-corrupt-tick-defense] intact for future DATs.
   `frontend/src/app/dats/[address]/page.tsx` hard-404s any address other
   than ADDR.strategy - the dashboard renders that DAT's data
   unconditionally, so any other address would serve it under a false name.
3. **SSR is a requirement, not a default.** Until 2026-07 the old
   providers file wrapped the entire tree in dynamic(ssr:false), so every
   route served an empty shell: zero anchors, zero h1, nothing for AI
   crawlers or unfurlers. Googlebot's JS rendering masked it, which is why
   it shipped unnoticed (W1.1 in `docs/90-seo-roadmap.md`).
   `frontend/src/app/providers.tsx` is now a plain "use client" component
   and `frontend/src/lib/wagmi-client.ts` sets ssr:true for a
   deterministic no-wallet first paint. Never reintroduce an ssr:false
   boundary in any layout path; only wallet-consuming leaves may bail out.
4. **Providers** (`frontend/src/app/providers.tsx`): WagmiProvider (config
   from client-only `frontend/src/lib/wagmi-client.ts`; server-safe
   constants and the env-overridable ADDR map in `frontend/src/lib/wagmi.ts`
   [inv: vercel-env-overrides]), QueryClientProvider (staleTime 10s, no
   refetch on focus, retry 2), RainbowKit dark theme. Shared on-chain state
   comes through useSnapshot -> /api/snapshot [inv: rpc-cost-not-per-visitor];
   indexer and keeper status only via the proxies [inv: same-origin-proxies];
   all RPC via `frontend/src/lib/rpc.ts` [inv: rpc-failover-infura-first].
   Every tx button follows [inv: tx-busy-guard].
5. **Docs subdomain.** `frontend/src/middleware.ts` 308-redirects
   docs.on-chaindat.com/* to www.on-chaindat.com/docs/*, converging stray
   /docs prefixes on one target [inv: docs-subdomain-308-not-rewrite]; the
   matcher skips _next assets and any path with an extension. The earlier
   REWRITE era forced two workarounds this design retired: every root
   special file (icon, robots, sitemap) needed a re-export under /docs or
   the subdomain 404ed it, and usePathname() returned the visible path
   (/faq) while nav stored /docs/faq, breaking active-link highlighting
   until canonicalized. With the 308, `frontend/src/components/docs-shell.tsx`
   compares usePathname() directly against `frontend/src/lib/docs-nav.ts`
   hrefs, and dropping the layout host check let the docs tree prerender
   statically. New subdomain = one SUBDOMAIN_PREFIXES entry.
6. **Theme and responsive matrix.** Single locked cyberpunk palette in
   `frontend/src/app/globals.css` (HSL variables, locked 2026-05-03); no
   alternative themes, no light mode, every UI change verified at
   320/375/768/1024/1440 px [inv: theme-lock-responsive-matrix]. Touch
   targets >= 44px are enforced globally under max-width 768px there. UI
   copy uses plain hyphens only [inv: no-em-dash].
7. **Consent and analytics chrome** (`frontend/src/app/layout.tsx` order):
   SiteJsonLd, Providers, TermsGate, CookieConsent, Vercel Analytics,
   GoogleAnalytics. `frontend/src/components/terms-gate.tsx` is a blocking
   modal (localStorage ldat-tos-accepted-v1) that skips /terms and /docs/*
   via its own inline checks; `frontend/src/lib/tos.ts` mirrors those skip
   conditions (plus docs.-hosts) so the consent banner knows when the gate
   is up.
   `frontend/src/components/google-analytics.tsx` loads GA4 G-FE3G03SSJ8
   with Consent Mode v2 defaulting everything denied (cookieless); the
   non-blocking banner `frontend/src/components/cookie-consent.tsx` (never
   shown while the TOS gate is up) can grant analytics_storage only, state
   shared through `frontend/src/lib/consent.ts`. Both gates start hidden so
   SSR markup matches the first client paint.
8. **SEO surfaces.** Root metadata sets metadataBase to www and
   alternates.canonical "./" so every route emits a self-referencing
   canonical on the canonical host. `frontend/src/app/robots.ts` allows
   /api on purpose (the supply endpoints are submitted to aggregators);
   plus `frontend/src/app/sitemap.ts`, the satori OG image and icons,
   `frontend/public/llms.txt`, and the IndexNow key file
   `frontend/public/8152797bdb756f9c95f5ad2505b1a19b.txt`
   [inv: indexnow-key-immutable].

## Owns

`frontend/src/app/layout.tsx`, `frontend/src/app/providers.tsx`,
`frontend/src/app/globals.css`, `frontend/src/middleware.ts`, all page and
layout files under `frontend/src/app/` (API routes excluded),
`frontend/src/app/robots.ts`, `frontend/src/app/sitemap.ts`, the chrome and
consent components (`frontend/src/components/header.tsx`, footer,
terms-gate, cookie-consent, google-analytics, docs-shell),
`frontend/src/lib/docs-nav.ts`, `frontend/src/lib/consent.ts`,
`frontend/src/lib/tos.ts`, `frontend/next.config.mjs`.

## Local invariants

[inv: theme-lock-responsive-matrix] - lives in `frontend/src/app/globals.css`
(register lists the marker as a convention). [inv: docs-subdomain-308-not-rewrite]
- lives at SUBDOMAIN_PREFIXES in `frontend/src/middleware.ts`. Reads
[inv: vercel-env-overrides], [inv: rpc-cost-not-per-visitor],
[inv: same-origin-proxies], [inv: rpc-failover-infura-first],
[inv: tx-busy-guard], [inv: pool-id-derived-at-runtime],
[inv: chart-corrupt-tick-defense], [inv: indexnow-key-immutable] as context.

## Verify

- SSR: `for u in / /about /docs/ldat; do curl -sL "https://www.on-chaindat.com$u" | grep -o '<h1' | wc -l; done`
  gives >= 1 each (never `grep -c` - Next serves one line, so it caps at 1).
- Subdomain: `curl -sI https://docs.on-chaindat.com/ldat` gives 308 with
  location https://www.on-chaindat.com/docs/ldat.
- `npm run build` in frontend/ compiles with the docs tree Static, not
  Dynamic (Dynamic there means a host/header check crept back in).
- Screenshot pass at 320/375/768/1024/1440 px: no horizontal overflow, no
  theme drift.
- Page source contains the consent-default script (all storage denied)
  before the gtag.js loader.

## Gotchas

- typedRoutes is on in `frontend/next.config.mjs`; dynamic href strings
  need casts (docs-shell casts `item.href as never`). The webpack externals
  there (pino-pretty, lokijs, encoding) are WalletConnect needs, not cruft.
- There is no vercel.json; root directory frontend/, domains and the
  load-bearing NEXT_PUBLIC_*_ADDRESS envs live in the Vercel dashboard
  [inv: vercel-env-overrides]. Deploys ride git push to main; CLI deploys
  run from the repo root, not frontend/.
- Right after a launch gate opens, GeckoTerminal has not indexed the first
  swap yet, so the embed shows its own empty state for a while - that is a
  cold-start gap, not a frontend bug.
- The five-width verification historically ran via a dedicated UI-tester
  subagent; that agent definition is no longer in the repo, so today it
  means a manual Playwright/screenshot pass at the same widths.
