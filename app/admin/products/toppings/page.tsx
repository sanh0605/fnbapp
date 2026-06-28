import { findAll } from "@/lib/sheets_db";
import ToppingsManager from "@/components/ToppingsManager";
import StickyFilterBar from "@/components/StickyFilterBar";

export const dynamic = "force-dynamic";

export default async function ToppingsAdminPage() {
  const products = await findAll("Products");
  const toppings = (products as any[]).filter(
    (p: any) => p.category_id === "CAT-007"
  );

  return (
    <div className="space-y-6">
      <StickyFilterBar
        title="Quản lý Topping Standalone"
        subtitle="Bật/tắt bán topping độc lập trên POS (CAT-007)."
      >
        <div />
      </StickyFilterBar>
      <ToppingsManager products={toppings} />
    </div>
  );
}
