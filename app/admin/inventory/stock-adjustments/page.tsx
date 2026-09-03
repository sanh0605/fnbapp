import { findAll } from "@/lib/sheets_db";
import StockAdjustmentsClient from "./components/StockAdjustmentsClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function StockAdjustmentsPage() {
  const [adjustments, semiProducts, units] = await Promise.all([
    findAll("Stock_Adjustments"),
    findAll("Semi_Products"),
    findAll("Units"),
  ]);

  // Build a map of item ID -> item details (name, unitName)
  // base_ingredients dropped 2026-09-01 --
  // stock_adjustments holds 0 rows in production (OPEN-ITEMS 80: the create
  // path was never wired to a form), so no adjustment has ever needed a
  // name resolved through that table.
  const itemMap: Record<string, { name: string; unitName: string }> = {};

  semiProducts.forEach((s: any) => {
    const unitName = units.find((u: any) => u.id === s.base_unit)?.name || s.base_unit;
    itemMap[s.id] = { name: s.name, unitName };
  });

  // Enrich adjustments with item names and units
  const enrichedAdjustments = adjustments.map((adj: any) => ({
    ...adj,
    item_name: itemMap[adj.item_reference]?.name || adj.item_reference || "Không rõ",
    unitName: itemMap[adj.item_reference]?.unitName || "",
  }));

  // Sort by created_at descending (newest first)
  enrichedAdjustments.sort((a: any, b: any) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <StockAdjustmentsClient adjustments={enrichedAdjustments} />
    </Suspense>
  );
}
