import { getBaseIngredientsData } from "./actions";
import BaseIngredientsClient from "./components/BaseIngredientsClient";

export const dynamic = "force-dynamic";

export default async function BaseIngredientsPage() {
  const { ingredients, units } = await getBaseIngredientsData();
  return <BaseIngredientsClient ingredients={ingredients} units={units} />;
}
