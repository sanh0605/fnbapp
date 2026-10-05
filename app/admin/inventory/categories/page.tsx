import { findAll } from "@/lib/db/tables";
import CategoriesClient from "./components/CategoriesClient";
import { resolveActor } from "@/lib/auth/auth";
import type { DBItemCategory } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const [categories, auth] = await Promise.all([
    findAll("Item_Categories") as Promise<DBItemCategory[]>,
    resolveActor(),
  ]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteItemCategory is what
  // actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  return (
    <CategoriesClient
      categories={categories}
      canDelete={canDelete}
      initialPage={searchParams?.page}
    />
  );
}
