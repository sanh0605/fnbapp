import { getIssueSlipsPage } from "./actions";
import IssueSlipsClient from "./components/IssueSlipsClient";
import type { IssueSlipListFilters } from "@/lib/stock/issue-slip-list";

export const dynamic = "force-dynamic";

export default async function IssueSlipsPage({
  searchParams,
}: {
  searchParams: { q?: string; kind?: string; person?: string; from?: string; to?: string; page?: string };
}) {
  const filters: IssueSlipListFilters = {
    q: searchParams.q,
    kind: searchParams.kind,
    person: searchParams.person,
    from: searchParams.from,
    to: searchParams.to,
    page: searchParams.page,
  };
  const pageData = await getIssueSlipsPage(filters);
  return <IssueSlipsClient pageData={pageData} />;
}
