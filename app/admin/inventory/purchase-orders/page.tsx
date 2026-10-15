import { getPurchaseOrdersPage } from "./actions";
import PurchaseOrdersClient from "./components/PurchaseOrdersClient";
import type { PurchaseOrderListFilters } from "@/lib/purchasing/purchase-order-list";
import { saigonToday } from "@/lib/shared/datetime";
import { readRangeParams } from "@/lib/shared/date-range-params";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const getParam = (key: string) => {
    const val = searchParams?.[key];
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] : undefined;
  };

  const today = saigonToday();
  const range = readRangeParams(searchParams ?? {}, today, "THIS_MONTH");
  const q = getParam("q");
  const searching = Boolean(q?.trim());

  const filters: PurchaseOrderListFilters = {
    q,
    status: getParam("status"),
    supplier: getParam("supplier"),
    from: searching ? undefined : range.start,
    to: searching ? undefined : range.end,
    page: getParam("page"),
    pay: getParam("pay"),
    account: getParam("account"),
  };
  const pageData = await getPurchaseOrdersPage(filters);
  return (
    <PurchaseOrdersClient
      pageData={pageData}
      range={range}
      today={today}
      searching={searching}
    />
  );
}
