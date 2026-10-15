import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { getMonthlyItems } from "../actions";
import { MonthlyItemDetailView } from "./components/MonthlyItemDetailView";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback: string = "/admin/finance/monthly-items"): string {
  if (!raw) return fallback;
  if (raw.startsWith("/admin/finance/monthly-items")) return raw;
  return fallback;
}

export default async function MonthlyItemDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [rows, categories, auth] = await Promise.all([
    getMonthlyItems(),
    getCashCategories(),
    resolveActor(),
  ]);

  const found = rows.find((r) => r.item.id === params.id);
  if (!found) {
    notFound();
  }

  const { item, entryCount } = found;
  const category = categories.find((c) => c.id === item.cash_category_id);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(searchParams?.returnTo);
  const returnTo = rawReturnTo.startsWith(`/admin/finance/monthly-items/${encodeURIComponent(item.id)}`)
    ? "/admin/finance/monthly-items"
    : rawReturnTo;

  return (
    <MonthlyItemDetailView
      item={item}
      category={category}
      entryCount={entryCount}
      canDelete={canDelete}
      returnTo={returnTo}
    />
  );
}
