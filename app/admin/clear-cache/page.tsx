import { revalidateTag } from "next/cache";

export default async function Page() {
  revalidateTag("sheets-Recipes");
  revalidateTag("sheets-Product_Variants");
  revalidateTag("sheets-Products");
  revalidateTag("sheets-Product_Price_History");
  return <div>Cache cleared</div>;
}
