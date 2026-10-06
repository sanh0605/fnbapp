import { getIssueSlipFormData } from "../actions";
import { IssueSlipClient } from "../components/IssueSlipClient";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewIssueSlipPage() {
  const items = await getIssueSlipFormData();

  return (
    <DetailFrame>
      <DetailHeader
        backHref="/admin/inventory/issue-slips"
        backLabel="Phiếu xuất"
        title="Tạo phiếu xuất"
        subtitle="Ghi nhận nguyên liệu lấy ra khỏi kho."
      />
      <IssueSlipClient items={items} />
    </DetailFrame>
  );
}
