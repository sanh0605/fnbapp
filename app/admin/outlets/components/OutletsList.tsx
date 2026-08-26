import { OutletForm, RetireOutletButton } from "./OutletForm";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DBOutlet, DBBrand } from "@/types/db";

interface OutletsListProps {
  outlets: DBOutlet[];
  brands: DBBrand[];
}

// Extracted out of page.tsx so it is directly render-testable: page.tsx's
// default export is an async Server Component, and Next's route-module
// typing forbids importing/rendering that export outside the framework --
// the same reason OPEN-ITEMS 41 extracted ItemCard out of
// app/admin/reports/issued/page.tsx.
export function OutletsList({ outlets, brands }: OutletsListProps) {
  const brandNameById = new Map(brands.map(b => [b.id, b.name]));

  if (outlets.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border">
        <EmptyState
          icon="🏪"
          title="Chưa có điểm bán"
          description="Thêm điểm bán đầu tiên để bắt đầu."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {outlets.map((outlet) => (
        <div key={outlet.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-text-primary">{outlet.name}</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {brandNameById.get(outlet.brand_id) || outlet.brand_id}
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary border border-primary/20 font-mono">
              {outlet.code}
            </span>
          </div>

          {outlet.status !== "ACTIVE" && (
            <span className="self-start inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary border border-border">
              Ngừng hoạt động
            </span>
          )}

          <div className="text-sm text-text-secondary space-y-1">
            <div>
              <span className="text-text-muted">Bắt đầu:</span>{" "}
              <span className="font-medium">
                {outlet.start_date ? new Date(outlet.start_date).toLocaleDateString("en-GB") : "N/A"}
              </span>
            </div>
            {outlet.end_date && (
              <div>
                <span className="text-text-muted">Kết thúc:</span>{" "}
                <span className="font-medium">{new Date(outlet.end_date).toLocaleDateString("en-GB")}</span>
              </div>
            )}
            <div>
              <span className="text-text-muted">Giờ hoạt động:</span>{" "}
              <span className="font-medium">
                {outlet.open_time && outlet.close_time
                  ? `${outlet.open_time.slice(0, 5)} - ${outlet.close_time.slice(0, 5)}`
                  : "Chưa đặt"}
              </span>
            </div>
          </div>

          <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
            <div className="flex items-center min-h-[44px]">
              <OutletForm initialData={outlet} brands={brands} outlets={outlets} />
            </div>
            <div className="flex items-center min-h-[44px]">
              <RetireOutletButton outlet={outlet} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
