// BR-CATALOG-003 (owner decision 2026-09-08, "The link is the join, not the
// name"). The old code in both app/admin/reports/pnl-actions.ts
// (buildStandaloneToppingMap) and app/pos/actions.ts
// (getPOSBestSellerProductIds) matched `topping-standalone::mod_id=MOD-\d+`
// against products.migration_notes -- a column that has never existed on
// products (11 columns in supabase/migrations/0001_init_schema.sql, no
// later `alter table products add column`). The regex never matched. This
// is the one place that reads the real join instead: modifiers.product_id
// (migration 0097). Called by both sites so they can only ever agree.
//
// A stopped (INACTIVE) modifier must never win a link over an ACTIVE one: MOD-007
// (INACTIVE) and MOD-008 (ACTIVE) both carry product_id PROD-035, and only
// one modifier may govern that product's switch (plan question 3). Grouping by
// product and preferring ACTIVE makes the result independent of the input order.
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
  const byProduct = new Map<string, any[]>();
  for (const m of modifiers) {
    if (!m.product_id) continue;
    const productId = String(m.product_id);
    byProduct.set(productId, [...(byProduct.get(productId) ?? []), m]);
  }
  const map = new Map<string, string>();
  for (const [productId, linked] of byProduct) {
    // A stopped option (INACTIVE) still links its dish, but an ACTIVE one governs it
    // when both exist (MOD-007 and MOD-008 both link PROD-035).
    const active = linked.filter((m) => m.status === "ACTIVE");
    const governing = active.length > 0 ? active : linked;
    if (governing.length === 1) {
      map.set(productId, String(governing[0].id));
      continue;
    }
    console.error(
      `buildStandaloneToppingProductLinks: more than one ACTIVE modifier links to product ${productId} -- excluding it. This should be impossible (migration 0098 refuses it at write time); check for a direct DB edit or a writer that bypasses the guard.`,
    );
  }
  return map;
}
