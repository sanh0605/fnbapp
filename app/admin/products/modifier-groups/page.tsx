import { Suspense } from "react";
import { getModifierGroups } from "./actions";
import ModifierGroupsClient from "./components/ModifierGroupsClient";

export const dynamic = "force-dynamic";

export default async function ModifierGroupsPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const rows = await getModifierGroups();
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ModifierGroupsClient
        rows={rows}
        initialSearch={searchParams?.q || ""}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
