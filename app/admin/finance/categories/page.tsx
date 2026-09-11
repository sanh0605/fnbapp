import { resolveActor } from "@/lib/auth/auth";
import { findAll } from "@/lib/db/tables";
import { getCashCategories } from "./actions";
import { CategoriesList } from "./components/CategoriesList";
import { CategoryForm } from "./components/CategoryForm";
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
        actions={<CategoryForm />}
      />
      <CategoriesList categories={categories} canDelete={canDelete} usedCategoryIds={usedCategoryIds} />
    </div>
  );
}
