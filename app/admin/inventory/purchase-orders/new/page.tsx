import { findAll } from "@/lib/sheets_db";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const [suppliers, items, conversions, baseIngredients, allUnits, sources] = await Promise.all([
    findAll("Suppliers"),
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Base_Ingredients"),
    findAll("Units"),
    findAll("Purchase_Sources")
  ]);

  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/inventory/purchase-orders" 
          className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-lg border border-gray-200 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tạo Phiếu Nhập Kho</h1>
          <p className="text-sm text-gray-500 mt-1">Nhập hàng hoá từ nhà cung cấp vào kho.</p>
        </div>
      </div>

      <PurchaseOrderForm 
        suppliers={suppliers}
        sources={sources}
        items={items}
        conversions={conversions}
        baseIngredients={baseIngredients}
        units={units}
      />
    </div>
  );
}
