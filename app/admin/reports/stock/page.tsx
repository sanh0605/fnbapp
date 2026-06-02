import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getRealtimeStock } from "@/app/actions/stock";
import { findAll } from "@/lib/sheets_db";
import StockTable from "@/components/StockTable";

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const role = session.user?.role || "STAFF";
  const username = session.user?.name || "Unknown";

  const [stockItems, adjustments] = await Promise.all([
    getRealtimeStock(),
    findAll("Stock_Adjustments")
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Quản lý & Cân bằng Tồn kho</h1>
          <p className="text-gray-500 mt-1">Kiểm kê số lượng thực tế và điều chỉnh nếu có sai lệch.</p>
        </div>
      </div>

      <StockTable 
        stockItems={stockItems} 
        adjustments={adjustments} 
        role={role} 
        username={username} 
      />
    </div>
  );
}
