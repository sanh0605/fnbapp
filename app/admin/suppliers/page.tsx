import { getSuppliers } from "./actions";
import SuppliersClient from "./components/SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();
  return <SuppliersClient suppliers={suppliers} />;
}
