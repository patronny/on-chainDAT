/**
 * Thin GraphQL client for the on-chainDAT / LDAT Ponder indexer
 * (testnet phase: still indexes the deployed $LINEASTR strategy on Base Sepolia).
 *
 * Indexer source: automation/indexer/, deployed on Fly. The browser reaches
 * it through the same-origin /api/indexer proxy (see INDEXER_URL below); the
 * real Fly URL lives server-side in INDEXER_URL / NEXT_PUBLIC_INDEXER_URL env.
 * Schema covers two tables: `bag` (BoughtByProtocol+SoldByProtocol joined by
 * bagId) and `swap` (hook Trade events).
 *
 * No Apollo / urql / SWR pulled in - one tiny POST helper is enough; React
 * components manage their own loading state via useEffect + setInterval.
 */

// Same-origin proxy (frontend/src/app/api/indexer). The browser MUST NOT hit
// the Fly indexer directly: fly.dev is unreachable from sanctioned regions
// (e.g. Belarus), which blanked swaps/bags/sales/24h-volume/24h-change there.
// The proxy route forwards to the real indexer server-side (server-only env).
// INV:same-origin-proxies browser hits same-origin proxy only; see docs/INVARIANTS.md
export const INDEXER_URL = "/api/indexer";

export const INDEXER_ENABLED = !!INDEXER_URL && !INDEXER_URL.includes("disabled");

// Raised 2026-06-09 (launch): under launch load the indexer GraphQL occasionally
// exceeded the old 1.5s probe / 4s fetch timeouts, flipping `usable` false and
// (previously) triggering the expensive on-chain getLogs fallback. Be patient with
// a healthy-but-busy indexer so we stay on cheap GraphQL instead.
const INDEXER_TIMEOUT_MS = 8_000;
const PROBE_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 10_000;

export type BagRow = {
  bagId: string;          // bigint as string from GraphQL
  blockNumber: string;
  timestamp: number;
  txHash: `0x${string}`;
  paid: string;           // wei
  listPrice: string;      // wei
  soldFor: string | null;
  soldAt: number | null;
  soldTxHash: `0x${string}` | null;
  buyer: `0x${string}` | null;
};

export type SwapRow = {
  id: string;
  blockNumber: string;
  timestamp: number;
  txHash: `0x${string}`;
  trader: `0x${string}`;
  side: "buy" | "sell";
  ethAmount: string;
  tokenAmount: string;
  sqrtPriceX96: string;
};

export type Page<T> = {
  items: T[];
  totalCount: number;
  pageInfo: { endCursor: string | null; hasNextPage: boolean; startCursor: string | null; hasPreviousPage: boolean };
};

function signalWithTimeout(parent: AbortSignal | undefined, timeoutMs: number) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  const abort = () => ctrl.abort();
  parent?.addEventListener("abort", abort, { once: true });

  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    },
  };
}

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs = INDEXER_TIMEOUT_MS
): Promise<T> {
  if (!INDEXER_ENABLED) throw new Error("indexer disabled");
  const req = signalWithTimeout(signal, timeoutMs);
  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`indexer http ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    if (!json.data) throw new Error("indexer empty response");
    return json.data;
  } finally {
    req.cleanup();
  }
}

const BAG_FIELDS = `bagId blockNumber timestamp txHash paid listPrice soldFor soldAt soldTxHash buyer`;
const SWAP_FIELDS = `id blockNumber timestamp txHash trader side ethAmount tokenAmount sqrtPriceX96`;
let bagsCache: { rows: BagRow[]; at: number } | null = null;
let bagsInflight: Promise<BagRow[]> | null = null;
const swapsCache = new Map<number, { rows: SwapRow[]; at: number }>();
const swapsInflight = new Map<number, Promise<SwapRow[]>>();

/**
 * All bags (active listings = soldAt:null, sold = soldAt_not:null).
 * Holdings table filters in-memory; Sales table filters in-memory.
 */
export async function fetchBags(signal?: AbortSignal): Promise<BagRow[]> {
  const now = Date.now();
  if (!signal && bagsCache && now - bagsCache.at < CACHE_TTL_MS) return bagsCache.rows;
  if (!signal && bagsInflight) return bagsInflight;

  const run = async () => {
    try {
      const data = await gql<{ bags: Page<BagRow> }>(
        `query { bags(orderBy: "blockNumber", orderDirection: "desc", limit: 1000) { items { ${BAG_FIELDS} } } }`,
        undefined,
        signal
      );
      bagsCache = { rows: data.bags.items, at: Date.now() };
      return data.bags.items;
    } catch (err) {
      if (bagsCache) return bagsCache.rows;
      throw err;
    }
  };

  if (signal) return run();
  bagsInflight = run().finally(() => {
    bagsInflight = null;
  });
  return bagsInflight;
}

/**
 * Most-recent swaps. limit caps a single fetch - pagination via `after`
 * cursor is not wired into the table UI yet (it pages client-side).
 */
export async function fetchSwaps(limit = 200, signal?: AbortSignal): Promise<SwapRow[]> {
  const now = Date.now();
  const cached = swapsCache.get(limit);
  if (!signal && cached && now - cached.at < CACHE_TTL_MS) return cached.rows;
  const inflight = swapsInflight.get(limit);
  if (!signal && inflight) return inflight;

  const run = async () => {
    try {
      const data = await gql<{ swaps: Page<SwapRow> }>(
        `query($limit: Int!) { swaps(orderBy: "timestamp", orderDirection: "desc", limit: $limit) { items { ${SWAP_FIELDS} } } }`,
        { limit },
        signal
      );
      swapsCache.set(limit, { rows: data.swaps.items, at: Date.now() });
      return data.swaps.items;
    } catch (err) {
      const stale = swapsCache.get(limit);
      if (stale) return stale.rows;
      throw err;
    }
  };

  if (signal) return run();
  const promise = run().finally(() => {
    swapsInflight.delete(limit);
  });
  swapsInflight.set(limit, promise);
  return promise;
}

/**
 * Price baseline for the 24h change widget.
 *
 * Preferred baseline is the earliest swap after `sinceUnix`. If no one traded
 * during the last 24h, use the latest known swap before the window instead of
 * blanking the widget. That keeps the header useful during quiet testnet periods.
 */
export async function fetchBaselineSwapFor24h(
  sinceUnix: number,
  signal?: AbortSignal
): Promise<SwapRow | null> {
  const after = await gql<{ swaps: Page<SwapRow> }>(
    `query($since: Int!) {
      swaps(
        where: { timestamp_gt: $since }
        orderBy: "timestamp"
        orderDirection: "asc"
        limit: 1
      ) { items { ${SWAP_FIELDS} } }
    }`,
    { since: sinceUnix },
    signal
  );
  if (after.swaps.items[0]) return after.swaps.items[0];

  const before = await gql<{ swaps: Page<SwapRow> }>(
    `query($since: Int!) {
      swaps(
        where: { timestamp_lte: $since }
        orderBy: "timestamp"
        orderDirection: "desc"
        limit: 1
      ) { items { ${SWAP_FIELDS} } }
    }`,
    { since: sinceUnix },
    signal
  );
  if (before.swaps.items[0]) return before.swaps.items[0];

  const earliest = await gql<{ swaps: Page<SwapRow> }>(
    `query {
      swaps(orderBy: "timestamp", orderDirection: "asc", limit: 1) {
        items { ${SWAP_FIELDS} }
      }
    }`,
    undefined,
    signal
  );
  return earliest.swaps.items[0] ?? null;
}

/**
 * All swaps for a single trader (lowercase address). Used by the portfolio
 * holdings card to compute avg cost basis. Cap at 1000 rows; testnet users
 * almost never approach that.
 */
export async function fetchSwapsByTrader(
  trader: string,
  signal?: AbortSignal
): Promise<SwapRow[]> {
  const t = trader.toLowerCase();
  const data = await gql<{ swaps: Page<SwapRow> }>(
    `query($trader: String!) {
      swaps(
        where: { trader: $trader }
        orderBy: "timestamp"
        orderDirection: "asc"
        limit: 1000
      ) { items { ${SWAP_FIELDS} } }
    }`,
    { trader: t },
    signal
  );
  return data.swaps.items;
}

/**
 * Liveness probe for the indexer. Used by hooks to decide whether to fall
 * back to on-chain getLogs. ~120ms call, cached for 30s.
 */
let probeCache: { ok: boolean; at: number } | null = null;
let probeInflight: Promise<boolean> | null = null;
export async function probeIndexer(): Promise<boolean> {
  if (!INDEXER_ENABLED) return false;
  const now = Date.now();
  if (probeCache && now - probeCache.at < 30_000) return probeCache.ok;
  if (probeInflight) return probeInflight;

  probeInflight = (async () => {
    try {
      await gql<{ __typename: string }>(`{ __typename }`, undefined, undefined, PROBE_TIMEOUT_MS);
      probeCache = { ok: true, at: Date.now() };
      return true;
    } catch {
      probeCache = { ok: false, at: Date.now() };
      return false;
    } finally {
      probeInflight = null;
    }
  })();

  return probeInflight;
}
