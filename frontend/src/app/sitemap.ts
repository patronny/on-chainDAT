import type { MetadataRoute } from "next";

// Canonical host only - the docs subdomain and any deploy alias canonicalise to www.
const BASE = "https://www.on-chaindat.com";

// Hardcoded to match BASE: this file only ever describes production. Reading ADDR.strategy
// here would publish the dead Base Sepolia fallback if NEXT_PUBLIC_STRATEGY_ADDRESS were
// ever unset on a deploy.
const LDAT = "0x02F289E429655d0C0D713A7dFD26850A81f7cFC5";

// Omitted on purpose:
//   /docs/dat-types/yield - noindex until a yield DAT actually exists
//   /portfolio, /status - wallet-gated app shells with no search demand
// No lastModified/changeFrequency/priority: Google ignores the last two, and a build-time
// lastModified would restamp every URL on each deploy and devalue the signal.
const ROUTES = [
  "",
  "/about",
  "/dats",
  `/dats/${LDAT}`,
  "/transfer",
  "/contacts",
  "/terms",
  "/docs",
  "/docs/faq",
  "/docs/ldat",
  "/docs/tokenomics",
  "/docs/new-launches",
  "/docs/transfer",
  "/docs/dat-types",
  "/docs/dat-types/classic",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({ url: `${BASE}${path}` }));
}
