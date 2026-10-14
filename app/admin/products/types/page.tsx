import { Suspense } from "react";
import { getProductTypes } from "./actions";
import ProductTypesClient from "./components/ProductTypesClient";

export const dynamic = "force-dynamic";

export default async function ProductTypesPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const rows = await getProductTypes();
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ProductTypesClient
        rows={rows}
        initialSearch={searchParams?.q || ""}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
