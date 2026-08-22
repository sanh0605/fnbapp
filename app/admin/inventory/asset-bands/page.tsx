import { getAssetBands } from "./actions";
import { BandEditForm } from "./components/BandEditForm";
import { AddBandForm } from "./components/AddBandForm";
import { DeleteBandButton } from "./components/DeleteBandButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBandRange } from "@/lib/asset-depreciation";

export const dynamic = "force-dynamic";

// Batch 3, section 5.3, extended 2026-08-23 (section 1 bound fix, section 2
// add/delete). Phone-first, phone-only for this batch (CLAUDE.md section 8,
// owner 2026-08-17): one card per band, no horizontal table.
export default async function AssetBandsPage() {
  const bands = await getAssetBands();

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Bảng Thời Hạn Khấu Hao</h1>
          <p className="text-sm text-text-secondary mt-1">
            Xác định số tháng khấu hao theo đơn giá 1 cái. Sửa khung chỉ áp dụng cho tài sản mua sau đó.
          </p>
        </div>
      </div>

      <AddBandForm />

      {bands.length === 0 ? (
        <EmptyState title="Chưa có khung khấu hao nào." />
      ) : (
        <div className="flex flex-col gap-3">
          {bands.map(band => (
            <div key={band.id} className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-text-secondary">Đơn giá</span>
                <span className="font-semibold text-text-primary">{formatBandRange(band)}</span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-text-secondary">Số tháng khấu hao</span>
                <span className="font-bold text-primary">{band.term_months} tháng</span>
              </div>
              <div className="flex justify-end items-center gap-4 pt-2 mt-1 border-t border-border">
                <BandEditForm band={band} />
                <DeleteBandButton band={band} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
