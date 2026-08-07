/**
 * Pure logic for scripts/reset-cost-at-sale.ts, split out so it is testable
 * without a live Supabase client (repo's existing -core.ts convention).
 *
 * Found 2026-08-07: PostgREST's .in() filter goes in the URL as a GET query
 * string. All 2.590 ids in one request measured at roughly 110 KB -- past
 * the transport-layer URL length limit, so the request broke before a
 * structured response existed to read an error message from (supabase-js
 * then surfaced an empty error). Batching is required for both the write
 * and any .in()-based read at this row count, not just the write -- the
 * original script batched the write and left the post-write verification
 * query unbatched, which is what broke.
 */
export function batchIds<T>(ids: readonly T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    throw new Error(`batchIds: batchSize must be positive, got ${batchSize}`);
  }
  const batches: T[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize) as T[]);
  }
  return batches;
}
