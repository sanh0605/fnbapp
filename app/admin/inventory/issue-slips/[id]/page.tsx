import { notFound } from "next/navigation";
import { getIssueSlipDetail, getIssueSlipFormData } from "../actions";
import IssueSlipDetailClient from "../components/IssueSlipDetailClient";

export default async function IssueSlipDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getIssueSlipDetail(params.id);
  if (!detail) {
    notFound();
  }

  const items = await getIssueSlipFormData();

  return <IssueSlipDetailClient detail={detail} items={items} />;
}
