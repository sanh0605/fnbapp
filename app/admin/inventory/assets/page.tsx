import { Button } from "@/components/ui/Button";
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
          <Button
            href="/admin/inventory/asset-bands"
            variant="secondary"
            className="w-full md:w-auto"
          >
            Thời hạn khấu hao
          </Button>
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
