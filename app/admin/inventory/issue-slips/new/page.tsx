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
      <PageHeader title="Tạo phiếu xuất" subtitle="Ghi nhận nguyên liệu lấy ra khỏi kho." />
      <IssueSlipClient items={items} />
    </div>
  );
}
