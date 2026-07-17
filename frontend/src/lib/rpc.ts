import { http, fallback, type Transport } from "viem";

/**
 * Linea RPC resilience: an ordered fallback transport instead of a single URL.
 *
 * viem `fallback()` always tries the transports in the given order and only
 * moves to the next on error, restarting from the first on every new request.
 * So if we put paid Infura FIRST and public RPCs after it, the app:
 *   - uses Infura whenever it is healthy (paid, reliable),
 *   - instantly falls through to a public RPC on any Infura error (per request,
 *     not on a timer),
 *   - automatically returns to Infura the moment it recovers,
 *   - skips a dead public and uses the next one in the list.
 * This replaces the old single-RPC setup that took the site to $0 during the
 * 2026-06-13 Infura/Linea outage (see obsidian work log).
 *
 * The URL list comes from env (comma-separated), Infura-first, and we always
 * append the public pool so the app is resilient even if the env is misset.
 */

const PUBLIC_POOL = [
  "https://linea.drpc.org",
  "https://linea-rpc.publicnode.com",
  "https://1rpc.io/linea",
];

function parseList(...candidates: (string | undefined)[]): string[] {
  for (const c of candidates) {
    if (c && c.trim()) {
      return c
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

// INV:rpc-failover-infura-first shared fallback transport, never single URL; see docs/INVARIANTS.md
function buildTransport(primary: string[]): Transport {
  const urls = [...new Set([...primary, ...PUBLIC_POOL])];
  return fallback(
    urls.map((u) => http(u)),
    { retryCount: 1 },
  );
}

/**
 * Server-side transport (API routes): Infura-first via the non-origin-locked
 * ops key. Source order: LINEA_RPC_URLS (comma list) -> legacy single-URL envs.
 */
export function lineaServerTransport(): Transport {
  return buildTransport(
    parseList(
      process.env.LINEA_RPC_URLS,
      process.env.LINEA_RPC_URL_SERVER,
      process.env.LINEA_RPC_URL,
    ),
  );
}

/**
 * Client-side transport (wagmi): Infura-first via the origin-locked frontend
 * key. NEXT_PUBLIC_ vars are inlined at build time.
 */
export function lineaClientTransport(): Transport {
  return buildTransport(
    parseList(
      process.env.NEXT_PUBLIC_LINEA_RPC_URLS,
      process.env.NEXT_PUBLIC_LINEA_RPC_URL,
    ),
  );
}
