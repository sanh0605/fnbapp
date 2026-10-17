import { findAll } from "@/lib/db/tables";
import { activeOrOnOrder } from "@/lib/purchasing/active-or-on-order";
import { getPurchaseOrderCopySeed } from "../actions";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { Alert } from "@/components/ui/Alert";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage(
  props: {
    searchParams?: Promise<{ copyFrom?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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

  const units = allUnits.filter(u => u.status === "ACTIVE");
  const bankAccounts = (allBankAccounts as any[]).filter(a => a.status === "ACTIVE");

  return (
    <DetailFrame>
      <DetailHeader
        backHref="/admin/inventory/purchase-orders"
        backLabel="Phiếu nhập"
        title="Tạo phiếu nhập"
        subtitle="Nhập hàng hoá từ nhà cung cấp vào kho."
      />

      {copyFrom && copySeed && (
        <Alert variant="info">
          Nhân bản từ phiếu{" "}
          <Link
            href={`/admin/inventory/purchase-orders/${encodeURIComponent(copyFrom)}`}
            className="font-bold underline text-primary hover:text-primary-hover"
          >
            {copyFrom}
          </Link>
        </Alert>
      )}

      {copyFrom && !copySeed && (
        <Alert variant="warning">
          Không tìm thấy phiếu {copyFrom} để nhân bản.
        </Alert>
      )}

      <PurchaseOrderForm 
        suppliers={activeOrOnOrder(suppliers, copySeed ? [copySeed.supplier_id] : [])}
        sources={sources}
        items={activeOrOnOrder(items, copySeed?.lines.map(l => l.purchased_item_id) ?? [])}
        conversions={conversions}
        units={units}
        bankAccounts={bankAccounts}
        copySeed={copySeed ?? undefined}
      />
    </DetailFrame>
  );
}
