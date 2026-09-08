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
//
// Opus code review, 2026-09-08: two ACTIVE modifiers pointing at one
// product is exactly the state migration 0098's sync_topping_price_atomic
// refuses at write time -- unreachable today (measured: 0 products with >1
// ACTIVE modifier), but this read-side helper must resolve it loudly or
// deterministically, not by silent first-or-last-wins. Chosen: skip, not
// refuse. This helper runs on every P&L report and every POS page load
// (app/pos/CLAUDE.md: the shop must not stop selling over a data anomaly),
// so a collision drops that product_id from the map entirely -- it falls
// through as an ordinary product, same as an unlinked orphan -- logged so
// the anomaly is discoverable, rather than throwing and taking either
// screen down.
export function buildStandaloneToppingProductLinks(modifiers: any[]): Map<string, string> {
  const map = new Map<string, string>();
  const conflictedProductIds = new Set<string>();
  for (const m of modifiers) {
    if (m.status === "DELETED") continue;
    if (!m.product_id) continue;
    const productId = String(m.product_id);
    const modifierId = String(m.id);
    const existing = map.get(productId);
    if (existing !== undefined && existing !== modifierId) {
      conflictedProductIds.add(productId);
      continue;
    }
    map.set(productId, modifierId);
  }
  for (const productId of conflictedProductIds) {
    map.delete(productId);
    console.error(
      `buildStandaloneToppingProductLinks: more than one ACTIVE modifier links to product ${productId} -- excluding it. This should be impossible (migration 0098 refuses it at write time); check for a direct DB edit or a writer that bypasses the guard.`,
    );
  }
  return map;
}
