import { redirect } from "next/navigation";
import { safeReturnTo } from "@/app/admin/products/components/return-to";

export const dynamic = "force-dynamic";

export default function ProductPriceHistoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const listReturnTo = rawReturnTo.startsWith("/admin/products/")
    ? "/admin/products"
    : rawReturnTo;

  redirect(
    `/admin/products/${encodeURIComponent(params.id)}?returnTo=${encodeURIComponent(listReturnTo)}#lich-su-gia`,
  );
}
