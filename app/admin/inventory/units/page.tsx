import { findAll } from "@/lib/db/tables";
import UnitsClient from "./components/UnitsClient";
import { resolveActor } from "@/lib/auth/auth";
import type { DBUnit } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const [allUnits, auth] = await Promise.all([
    findAll("Units") as Promise<DBUnit[]>,
    resolveActor(),
  ]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteUnit is what actually
  // blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  // Filter out softly deleted
  const units = allUnits.filter((u) => u.name && !u.name.startsWith("DELETED_"));

  return (
    <UnitsClient
      units={units}
      canDelete={canDelete}
      initialPage={searchParams?.page}
    />
  );
}
