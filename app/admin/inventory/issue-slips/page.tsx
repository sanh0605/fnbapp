import { getIssueSlipsPage } from "./actions";
import IssueSlipsClient from "./components/IssueSlipsClient";
import type { IssueSlipListFilters } from "@/lib/stock/issue-slip-list";
import { saigonToday } from "@/lib/shared/datetime";
import { readRangeParams } from "@/lib/shared/date-range-params";

export const dynamic = "force-dynamic";

export default async function IssueSlipsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const getParam = (key: string) => {
    const val = searchParams?.[key];
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] : undefined;
  };

  const today = saigonToday();
  const range = readRangeParams(searchParams ?? {}, today, "THIS_MONTH");
  const q = getParam("q");
  const searching = Boolean(q?.trim());

  const filters: IssueSlipListFilters = {
    q,
    kind: getParam("kind"),
    person: getParam("person"),
    from: searching ? undefined : range.start,
    to: searching ? undefined : range.end,
    page: getParam("page"),
  };
  const pageData = await getIssueSlipsPage(filters);
  return (
    <IssueSlipsClient
      pageData={pageData}
      range={range}
      today={today}
      searching={searching}
    />
  );
}
