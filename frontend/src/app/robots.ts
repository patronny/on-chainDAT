import type { MetadataRoute } from "next";

// No Disallow: /api/ on purpose. /api/supply/total and /api/supply/circulating are the
// supply endpoints submitted to CoinMarketCap and CoinGecko, and nothing in src/ links to
// /api/ at all, so there is no crawl path to budget for either way.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://www.on-chaindat.com/sitemap.xml",
  };
}
