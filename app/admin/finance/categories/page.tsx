import Link from "next/link";
import { resolveActor } from "@/lib/auth/auth";
import { findAll } from "@/lib/db/tables";
import { getCashCategories } from "./actions";
import { CategoriesList } from "./components/CategoriesList";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBCashEntry } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CashCategoriesPage() {
  const [categories, entries, auth] = await Promise.all([
    getCashCategories(),
    findAll("Cash_Entries") as Promise<DBCashEntry[]>,
    resolveActor(),
  ]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  // I3 -- owner decision 2026-09-11 ("Khoá, tạo nhóm mới"): every entry
  // counts, cancelled included -- a cancelled row is still history and
  // still locks the category's Thu/Chi side. Computed here (not via a new
  // guarded action) so categories/actions.ts keeps its exact exported-
  // function and guard-call counts, same as app/admin/brands/page.tsx
  // calling findAll directly rather than adding a wrapper.
  const usedCategoryIds = Array.from(new Set(entries.map((e) => e.category_id)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhóm thu chi"
        subtitle="Đặt tên các nhóm chi và thu. Nhóm đã có dòng sổ thì ngừng dùng, không xoá."
        actions={
          <Link
            href="/admin/finance/categories/new"
            className="bg-primary text-on-primary px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition inline-flex items-center justify-center min-h-[44px]"
          >
            + Thêm nhóm
          </Link>
        }
      />
      <CategoriesList categories={categories} canDelete={canDelete} usedCategoryIds={usedCategoryIds} />
    </div>
  );
}
