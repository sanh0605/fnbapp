import Link from "next/link";
import { getAssetsData } from "./actions";
import AssetsClient from "./components/AssetsClient";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
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

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: { tab?: string; page?: string };
}) {
  const assets = await getAssetsData();
  const requestedTab = searchParams?.tab;
  const activeTab: Tab =
    requestedTab === "FULLY_DEPRECIATED"
      ? "FULLY_DEPRECIATED"
      : requestedTab === "DISPOSED"
      ? "DISPOSED"
      : "IN_USE";

  const filtered = assets.filter((a: AssetView) => a.bucket === activeTab);

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Kho"
        title="Tài sản"
        action={
          <Link
            href="/admin/inventory/asset-bands"
            className="border border-border bg-surface-card text-text-primary px-4 py-2 rounded-lg font-medium hover:bg-surface-secondary transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm text-sm"
          >
            Thời hạn khấu hao
          </Link>
        }
      />

      <div className="flex md:justify-end">
        <div className="flex rounded-xl border border-border overflow-hidden w-full md:w-auto">
          {TABS.map(({ tab, label }) => (
            <Link
              key={tab}
              href={tabHref(tab)}
              className={`flex-1 md:flex-none text-center px-1 py-2.5 md:px-3 md:py-1.5 text-xs md:text-sm font-bold leading-tight transition-colors min-h-[44px] md:min-h-0 flex items-center justify-center ${
                activeTab === tab
                  ? "bg-primary text-on-primary"
                  : "bg-surface-card text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <AssetsClient
        assets={filtered}
        activeTab={activeTab}
        initialPage={searchParams?.page}
      />
    </div>
  );
}
