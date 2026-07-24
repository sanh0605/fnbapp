import { getStocktakeSessionData } from "./actions";
import { StocktakeClient } from "./components/StocktakeClient";

export const dynamic = "force-dynamic";

export default async function StocktakePage() {
  const session = await getStocktakeSessionData();
  return <StocktakeClient session={session} />;
}
