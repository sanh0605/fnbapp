import { getConversionsData } from "./actions";
import ConversionsClient from "./components/ConversionsClient";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const [data, auth] = await Promise.all([getConversionsData(), resolveActor()]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteConversionAction is
  // what actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  return <ConversionsClient {...data} canDelete={canDelete} />;
}
