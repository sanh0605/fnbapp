import { notFound } from "next/navigation";
import { getIssueSlipDetail, getIssueSlipFormData } from "../actions";
import IssueSlipDetailClient from "../components/IssueSlipDetailClient";

export const dynamic = "force-dynamic";

export default async function IssueSlipDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const detail = await getIssueSlipDetail(params.id);
  if (!detail) {
    notFound();
  }

  const items = await getIssueSlipFormData();

  const rawReturnTo = searchParams?.returnTo;
  const returnTo =
    typeof rawReturnTo === "string" &&
    (rawReturnTo === "/admin/inventory/issue-slips" ||
      rawReturnTo.startsWith("/admin/inventory/issue-slips?"))
      ? rawReturnTo
      : "/admin/inventory/issue-slips";

  return (
    <IssueSlipDetailClient
      detail={detail}
      items={items}
      returnTo={returnTo}
    />
  );
}
