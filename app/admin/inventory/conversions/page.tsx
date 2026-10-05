import { findAll } from "@/lib/db/tables";
import { getConversionsData } from "./actions";
import ConversionsClient from "./components/ConversionsClient";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function ConversionsPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const [data, auth, poLines] = await Promise.all([
    getConversionsData(),
    resolveActor(),
    findAll("Purchase_Order_Lines") as Promise<Array<{ conversion_id?: string }>>,
  ]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteConversionAction is
  // what actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  const usedConversionIds = Array.from(
    new Set(poLines.map((l) => l.conversion_id).filter(Boolean) as string[]),
  );

  return (
    <ConversionsClient
      {...data}
      usedConversionIds={usedConversionIds}
      canDelete={canDelete}
      initialSearch={searchParams?.q || ""}
      initialPage={searchParams?.page}
    />
  );
}
