import { findAll } from "@/lib/db/tables";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import Link from "next/link";

import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const [suppliers, items, conversions, allUnits, sources] = await Promise.all([
    findAll("Suppliers"),
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Units"),
    findAll("Purchase_Sources")
  ]);

  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <BackLink 
          href="/admin/inventory/purchase-orders" 
          label="Quay lại"
          className="p-2 text-text-muted hover:text-text-primary bg-surface-card rounded-lg border border-border shadow-sm inline-block"
        />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tạo Phiếu Nhập Kho</h1>
          <p className="text-sm text-text-muted mt-1">Nhập hàng hoá từ nhà cung cấp vào kho.</p>
        </div>
      </div>

      <PurchaseOrderForm 
        suppliers={suppliers}
        sources={sources}
        items={items}
        conversions={conversions}
        units={units}
      />
    </div>
  );
}
