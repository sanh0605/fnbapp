import { getIssueSlipFormData } from "../actions";
import { IssueSlipClient } from "../components/IssueSlipClient";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function NewIssueSlipPage() {
  const items = await getIssueSlipFormData();

  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/issue-slips" label="Phiếu xuất" />
      <PageHeader title="Tạo phiếu xuất" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      <IssueSlipClient items={items} />
    </div>
  );
}
