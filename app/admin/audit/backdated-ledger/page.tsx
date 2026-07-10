import { getSupabaseClient } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventRow } from "@/components/backdated-ledger/event-row";
import BackdatedLedgerClient from "./BackdatedLedgerClient";

export const dynamic = "force-dynamic";

export default async function BackdatedLedgerPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = getSupabaseClient();

  const status = typeof searchParams.status === "string" ? searchParams.status : "PENDING";
  const item_reference = typeof searchParams.item_reference === "string" ? searchParams.item_reference : "";
  const source_table = typeof searchParams.source_table === "string" ? searchParams.source_table : "ALL";
  const pageStr = typeof searchParams.page === "string" ? searchParams.page : "1";
  const page = parseInt(pageStr, 10) || 1;
  const pageSize = 50;

  let query = supabase
    .from("backdated_ledger_events")
    .select("*", { count: "exact" });

  if (status !== "ALL") {
    query = query.eq("status", status);
  }
  if (item_reference) {
    query = query.ilike("item_reference", `%${item_reference}%`);
  }
  if (source_table !== "ALL") {
    query = query.eq("source_table", source_table);
  }

  query = query
    .order("detected_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: events, count, error } = await query;

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-8">
      <PageHeader 
        title="Backdated Ledger Review" 
        subtitle="Các giao dịch nhập kho được backdate cần admin duyệt" 
      />

      <BackdatedLedgerClient />

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {events && events.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detected at</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Change</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lag</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500 flex justify-between items-center">
              <div>
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, count || 0)} of {count} events
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={`?page=${page - 1}&status=${status}&item_reference=${item_reference}&source_table=${source_table}`} className="text-blue-600 hover:underline">
                    Trang trước
                  </a>
                )}
                {count && page * pageSize < count && (
                  <a href={`?page=${page + 1}&status=${status}&item_reference=${item_reference}&source_table=${source_table}`} className="text-blue-600 hover:underline">
                    Trang tiếp
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState 
            title="Không có dữ liệu"
            description="Không có giao dịch backdate cần duyệt"
          />
        )}
      </div>
    </div>
  );
}
