import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getRealtimeStock } from "@/app/admin/inventory/actions";
import { findAll } from "@/lib/sheets_db";
import StockTable from "@/components/StockTable";

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any)?.role || "STAFF";
  const username = session.user?.name || "Unknown";

  const [stockItems, adjustments] = await Promise.all([
    getRealtimeStock(),
    findAll("Stock_Adjustments")
  ]);

  return (
    <div className="space-y-6">
      <StockTable 
        stockItems={stockItems} 
        adjustments={adjustments} 
        role={role} 
        username={username} 
      />
    </div>
  );
}
