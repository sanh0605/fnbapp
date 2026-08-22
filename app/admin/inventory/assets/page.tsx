import Link from "next/link";
import { getAssetsData } from "./actions";
import { AssetCard } from "./components/AssetCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AssetView } from "./actions";

export const dynamic = "force-dynamic";

type Tab = "IN_USE" | "FULLY_DEPRECIATED" | "DISPOSED";

const TABS: Array<{ tab: Tab; label: string }> = [
  { tab: "IN_USE", label: "Còn dùng" },
  { tab: "FULLY_DEPRECIATED", label: "Đã hết khấu hao" },
  { tab: "DISPOSED", label: "Đã thanh lý" },
];

function tabHref(tab: Tab): string {
  return `/admin/inventory/assets?tab=${tab}`;
}

// Batch 3, section 5.1: "Sổ tài sản." Phone-first, phone-only for this
// batch (CLAUDE.md section 8, owner 2026-08-17) -- no horizontal table,
// filter by còn dùng / đã hết khấu hao / đã thanh lý.
export default async function AssetsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const assets = await getAssetsData();
  const requestedTab = searchParams?.tab;
  const activeTab: Tab =
    requestedTab === "FULLY_DEPRECIATED" ? "FULLY_DEPRECIATED"
      : requestedTab === "DISPOSED" ? "DISPOSED"
      : "IN_USE";

  const filtered = assets.filter((a: AssetView) => a.bucket === activeTab);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Sổ Tài Sản</h1>
          <p className="text-sm text-text-secondary mt-1">Dụng cụ đã mua, theo khấu hao đường thẳng.</p>
        </div>
        <Link
          href="/admin/inventory/asset-bands"
          className="text-xs font-medium text-primary whitespace-nowrap min-h-[44px] flex items-center"
        >
          Bảng thời hạn
        </Link>
      </div>

      <div className="flex rounded-xl border border-border overflow-hidden">
        {TABS.map(({ tab, label }) => (
          <Link
            key={tab}
            href={tabHref(tab)}
            className={`flex-1 text-center px-1 py-2.5 text-xs font-bold leading-tight transition-colors min-h-[44px] flex items-center justify-center ${
              activeTab === tab ? "bg-primary text-white" : "bg-surface-card text-text-secondary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Không có tài sản nào ở mục này." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(asset => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
