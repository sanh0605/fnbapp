import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/shared/return-to";

export const dynamic = "force-dynamic";

export default async function ProductPriceHistoryPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const listReturnTo = rawReturnTo.startsWith("/admin/products/")
    ? "/admin/products"
    : rawReturnTo;

  redirect(
    `/admin/products/${encodeURIComponent(params.id)}?returnTo=${encodeURIComponent(listReturnTo)}#lich-su-gia`,
  );
}
