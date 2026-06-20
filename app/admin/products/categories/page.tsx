import { getCategoriesWithCounts } from "./actions";
import CategoriesClient from "./components/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage() {
  const { categories, counts } = await getCategoriesWithCounts();
  return <CategoriesClient categories={categories} counts={counts} />;
}
