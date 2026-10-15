import { listStocktakeSessions } from "./actions";
import { StocktakeList } from "./components/StocktakeList";

export const dynamic = "force-dynamic";

export default async function StocktakePage() {
  const sessions = await listStocktakeSessions();
  return <StocktakeList sessions={sessions} />;
}
