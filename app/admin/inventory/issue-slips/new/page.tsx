import { getIssueSlipFormData } from "../actions";
import { IssueSlipClient } from "../components/IssueSlipClient";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewIssueSlipPage() {
  const items = await getIssueSlipFormData();

  return (
    <div className="space-y-6">
      <Link href="/admin/inventory/issue-slips" className="text-sm font-medium text-primary hover:text-primary-hover no-underline self-start inline-block">
        ← Phiếu xuất
      </Link>
      <PageHeader title="Tạo phiếu xuất" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      <IssueSlipClient items={items} />
    </div>
  );
}
