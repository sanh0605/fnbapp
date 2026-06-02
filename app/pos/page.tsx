import { findAll } from "@/lib/sheets_db";
import POSScreen from "@/components/POSScreen";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function POSPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const [categories, products, variants, modifiers] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Modifiers")
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
  
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;

  return (
    <POSScreen 
      brandId={brandId}
      categories={activeCategories}
      products={activeProducts}
      variants={activeVariants}
      modifiers={activeModifiers}
    />
  );
}
