import { getOutlets } from "./actions";
import { getBrands } from "@/app/admin/brands/actions";
import { OutletForm } from "./components/OutletForm";
import { OutletsList } from "./components/OutletsList";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

// section 2:
// one card per outlet, no horizontal table -- phone-first (CLAUDE.md
// section 8). Owner has no other way to rename or retire an outlet; this
// screen is the whole point of the plan.
export default async function OutletsPage() {
  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Điểm bán"
        subtitle="Thêm, đổi tên và ngừng hoạt động điểm bán. Mã điểm bán không bao giờ bị xoá hay dùng lại."
        actions={<OutletForm brands={brands} outlets={outlets} />}
      />

      <OutletsList outlets={outlets} brands={brands} />
    </div>
  );
}
