import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRealtimeStock, getReorderSuggestions } from "@/app/admin/inventory/actions";
import { findAll } from "@/lib/sheets_db";
import StockTable from "@/components/StockTable";
import ReorderSuggestionTable from "@/components/ReorderSuggestionTable";

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any)?.role || "STAFF";
  const username = session.user?.name || "Unknown";

  const [stockItems, adjustments, reorderSuggestions] = await Promise.all([
    getRealtimeStock(),
    findAll("Stock_Adjustments"),
    getReorderSuggestions()
  ]);

  return (
    <div className="space-y-6">
      <ReorderSuggestionTable suggestions={reorderSuggestions} />
      <StockTable
        stockItems={stockItems}
        adjustments={adjustments}
        role={role}
        username={username}
      />
    </div>
  );
}
