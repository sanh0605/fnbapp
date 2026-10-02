import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { UnitDetailView } from "./components/UnitDetailView";
import type { DBUnit } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [allUnits, auth] = await Promise.all([
    findAll("Units") as Promise<DBUnit[]>,
    resolveActor(),
  ]);

  const unit = allUnits.find((u) => u.id === params.id);
  if (!unit || !unit.name || unit.name.startsWith("DELETED_")) {
    notFound();
  }

  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/units");
  const returnTo = rawReturnTo.startsWith("/admin/inventory/units/")
    ? "/admin/inventory/units"
    : rawReturnTo;

  return (
    <UnitDetailView
      unit={unit}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
