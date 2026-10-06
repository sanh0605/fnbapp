import { findAll } from "@/lib/db/tables";
import { getPurchaseOrderCopySeed } from "../actions";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import Link from "next/link";

import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams?: { copyFrom?: string };
}) {
  const copyFrom = searchParams?.copyFrom;

  const [suppliers, items, conversions, allUnits, sources, allBankAccounts, copySeed] = await Promise.all([
    findAll("Suppliers"),
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Units"),
    findAll("Purchase_Sources"),
    findAll("Bank_Accounts"),
    copyFrom ? getPurchaseOrderCopySeed(copyFrom) : Promise.resolve(null),
  ]);

  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
  const bankAccounts = (allBankAccounts as any[]).filter(a => a.status === "ACTIVE");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tạo Phiếu Nhập Kho</h1>
          <p className="text-sm text-text-muted mt-1">Nhập hàng hoá từ nhà cung cấp vào kho.</p>
        </div>
      </div>

      {copyFrom && copySeed && (
        <div
          role="status"
          className="p-4 rounded-xl border border-primary/30 bg-primary/10 text-text-primary text-sm"
        >
          Nhân bản từ phiếu{" "}
          <Link
            href={`/admin/inventory/purchase-orders/${encodeURIComponent(copyFrom)}`}
            className="font-bold underline text-primary hover:text-primary-hover"
          >
            {copyFrom}
          </Link>
        </div>
      )}

      {copyFrom && !copySeed && (
        <div
          role="status"
          className="p-4 rounded-xl border border-warning/40 bg-warning/10 text-warning-active text-sm font-medium"
        >
          Không tìm thấy phiếu {copyFrom} để nhân bản.
        </div>
      )}

      <PurchaseOrderForm 
        suppliers={suppliers}
        sources={sources}
        items={items}
        conversions={conversions}
        units={units}
        bankAccounts={bankAccounts}
        copySeed={copySeed ?? undefined}
      />
    </div>
  );
}
