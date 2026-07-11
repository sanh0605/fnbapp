import { getSupabaseClient } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventRow } from "@/components/backdated-ledger/event-row";
import BackdatedLedgerClient from "./BackdatedLedgerClient";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/backdated-ledger/status-badge";

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

      <div className="bg-surface-card rounded-lg shadow overflow-hidden border border-border">
        {events && events.length > 0 ? (
          <>
            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-full divide-y divide-gray-100 border-collapse text-sm">
                <thead className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">Detected at</th>
                    <th className="px-6 py-4 font-bold text-left">Source</th>
                    <th className="px-6 py-4 font-bold text-left">Item</th>
                    <th className="px-6 py-4 font-bold text-right">Qty Change</th>
                    <th className="px-6 py-4 font-bold text-right">Unit Cost</th>
                    <th className="px-6 py-4 font-bold text-left">Lag</th>
                    <th className="px-6 py-4 font-bold text-left">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-surface-card divide-y divide-gray-100">
                  {events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (< 768px) */}
            <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
              {events.map((event) => {
                const effectiveTime = new Date(event.effective_timestamp).getTime();
                const visibilityTime = new Date(event.visibility_timestamp).getTime();
                const lagMs = visibilityTime - effectiveTime;
                const lagDays = Math.floor(lagMs / (1000 * 60 * 60 * 24));
                const lagHours = Math.floor((lagMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const lagText = lagDays > 0 ? `${lagDays}d ${lagHours}h` : `${lagHours}h`;

                return (
                  <div key={event.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-text-primary">{event.item_reference}</div>
                        <div className="text-[11px] font-mono text-text-muted mt-0.5">
                          {event.source_table} / {event.source_id}
                        </div>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
                    
                    <div className="flex items-center justify-between mt-1 text-sm">
                      <div className="text-text-muted">
                        {formatDateTime(event.detected_at)}
                      </div>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <div className="text-[10px] text-text-muted uppercase font-bold">Lag</div>
                          <div className="font-medium">{lagText}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-text-muted uppercase font-bold">Qty / Cost</div>
                          <div className="font-bold">
                            <span className={event.quantity_change > 0 ? 'text-success' : event.quantity_change < 0 ? 'text-danger' : ''}>
                              {event.quantity_change > 0 ? '+' : ''}{event.quantity_change}
                            </span>
                            <span className="text-text-muted font-normal mx-1">@</span>
                            {formatNumber(event.unit_cost)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-3 mt-1 border-t border-border">
                      <Link 
                        href={`/admin/audit/backdated-ledger/${event.id}`}
                        className="flex items-center justify-center bg-surface-secondary text-primary font-bold py-2 px-4 rounded-lg text-sm w-full border border-border min-h-[44px]"
                      >
                        Chi tiết →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-border bg-surface-secondary text-sm text-text-muted flex justify-between items-center">
              <div>
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, count || 0)} of {count} events
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={`?page=${page - 1}&status=${status}&item_reference=${item_reference}&source_table=${source_table}`} className="text-primary hover:underline">
                    Trang trước
                  </a>
                )}
                {count && page * pageSize < count && (
                  <a href={`?page=${page + 1}&status=${status}&item_reference=${item_reference}&source_table=${source_table}`} className="text-primary hover:underline">
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
