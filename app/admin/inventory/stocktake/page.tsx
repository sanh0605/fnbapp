import { getStocktakeSessionData, getLastConfirmedStocktakeSession } from "./actions";
import { StocktakeClient } from "./components/StocktakeClient";

export const dynamic = "force-dynamic";

export default async function StocktakePage() {
  const [session, lastConfirmed] = await Promise.all([
    getStocktakeSessionData(),
    getLastConfirmedStocktakeSession(),
  ]);
  return <StocktakeClient session={session} lastConfirmed={lastConfirmed} />;
}
