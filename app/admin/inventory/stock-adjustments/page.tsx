import { findAll } from "@/lib/sheets_db";
import StockAdjustmentsClient from "./components/StockAdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function StockAdjustmentsPage() {
  const [adjustments, baseIngredients, semiProducts, units] = await Promise.all([
    findAll("Stock_Adjustments"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Units"),
  ]);

  // Build a map of item ID -> item details (name, unitName)
  const itemMap: Record<string, { name: string; unitName: string }> = {};
  
  baseIngredients.forEach((b: any) => {
    const unitName = units.find((u: any) => u.id === b.base_unit)?.name || b.base_unit;
    itemMap[b.id] = { name: b.name, unitName };
  });
  
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
    <StockAdjustmentsClient adjustments={enrichedAdjustments} />
  );
}
