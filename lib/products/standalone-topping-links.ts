// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 5 +
// BR-CATALOG-003 (owner decision 2026-09-08, "The link is the join, not the
// name"). The old code in both app/admin/reports/actions.ts
// (buildStandaloneToppingMap) and app/pos/actions.ts
// (getPOSBestSellerProductIds) matched `topping-standalone::mod_id=MOD-\d+`
// against products.migration_notes -- a column that has never existed on
// products (11 columns in supabase/migrations/0001_init_schema.sql, no
// later `alter table products add column`). The regex never matched. This
// is the one place that reads the real join instead: modifiers.product_id
// (migration 0097). Called by both sites so they can only ever agree.
//
// A DELETED modifier must never win a link: measured 2026-09-08, MOD-007
// (DELETED) and MOD-008 (ACTIVE) both carry product_id PROD-035, and only
// one modifier may govern that product's switch (plan question 3). Filtering
// DELETED out before the map is built makes the result independent of the
// input array's order.
export function buildStandaloneToppingProductLinks(modifiers: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of modifiers) {
    if (m.status === "DELETED") continue;
    if (!m.product_id) continue;
    map.set(String(m.product_id), String(m.id));
  }
  return map;
}
