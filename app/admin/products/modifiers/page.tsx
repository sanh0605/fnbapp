import { getModifiersData } from "./actions";
import ModifiersClient from "./components/ModifiersClient";

export const dynamic = "force-dynamic";

export default async function ModifiersPage() {
  const data = await getModifiersData();
  return <ModifiersClient {...data} />;
}
