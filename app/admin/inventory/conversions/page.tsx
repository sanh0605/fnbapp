import { getConversionsData } from "./actions";
import ConversionsClient from "./components/ConversionsClient";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const data = await getConversionsData();
  return <ConversionsClient {...data} />;
}
