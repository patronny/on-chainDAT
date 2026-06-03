"use client";

import { useSnapshot } from "./useSnapshot";

/**
 * Most-frequently-displayed strategy state. Backed by the CDN-cached
 * `/api/snapshot` Route Handler (via {@link useSnapshot}) instead of a
 * per-browser multicall, so RPC cost no longer scales with visitor count.
 * The return shape is unchanged, so existing consumers need no edits.
 */
export function useStrategyStats() {
  const { data, isLoading, error, refetch } = useSnapshot();
  return { data, isLoading, error, refetch };
}
