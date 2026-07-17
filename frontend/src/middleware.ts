import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Subdomain -> canonical path redirects for sister sites of on-chaindat.com.
 *
 * Each subdomain is a branded alias for a `/<prefix>/*` route on the canonical host:
 *
 *   docs.on-chaindat.com/            ->  www.on-chaindat.com/docs        (308)
 *   docs.on-chaindat.com/ldat        ->  www.on-chaindat.com/docs/ldat   (308)
 *   docs.on-chaindat.com/docs/ldat   ->  www.on-chaindat.com/docs/ldat   (308, stray prefix)
 *
 * Why redirect rather than rewrite? A rewrite served byte-identical pages on two hosts
 * with no way to emit a correct canonical: Next resolves a relative `alternates.canonical`
 * against the REQUEST path (`/ldat`), not the rewritten one (`/docs/ldat`), so the
 * subdomain advertised `www.on-chaindat.com/ldat` - a 404. A 308 removes the duplicate
 * outright, and dropping the host check from `docs/layout.tsx` lets the docs tree
 * prerender statically again (which keeps its metadata in <head>, not <body>).
 *
 * Static assets (`_next/static`, `_next/image`, files with an extension) are
 * excluded via the matcher.
 */
const CANONICAL_HOST = "www.on-chaindat.com";

// INV:docs-subdomain-308-not-rewrite 308 redirect, never a rewrite; see docs/INVARIANTS.md
const SUBDOMAIN_PREFIXES: Array<[string, string]> = [
  ["docs.", "/docs"],
];

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();

  for (const [hostPrefix, pathPrefix] of SUBDOMAIN_PREFIXES) {
    if (!host.startsWith(hostPrefix)) continue;

    // Strip a stray prefix first, so /ldat and /docs/ldat converge on one target.
    const path =
      req.nextUrl.pathname === pathPrefix ||
      req.nextUrl.pathname.startsWith(pathPrefix + "/")
        ? req.nextUrl.pathname.slice(pathPrefix.length)
        : req.nextUrl.pathname;

    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.port = "";
    url.pathname = `${pathPrefix}${path.replace(/\/$/, "")}`;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
