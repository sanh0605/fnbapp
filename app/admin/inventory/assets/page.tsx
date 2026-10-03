import Link from "next/link";
import { getAssetItemsData } from "./actions";
import AssetsClient from "./components/AssetsClient";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: { q?: string; all?: string; page?: string; sort?: string; dir?: string };
}) {
  const items = await getAssetItemsData();

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

      <AssetsClient
        items={items}
        initialSearch={searchParams?.q}
        initialAll={searchParams?.all === "1"}
        initialPage={searchParams?.page}
      />
    </div>
  );
}
