import { findAll } from "@/lib/db/tables";
import { getPurchaseOrderCopySeed } from "../actions";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

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

  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
  const bankAccounts = (allBankAccounts as any[]).filter(a => a.status === "ACTIVE");

  return (
    <div className="space-y-6 w-full">
      <BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />
      <PageHeader
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
