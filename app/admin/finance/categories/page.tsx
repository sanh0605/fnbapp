import { resolveActor } from "@/lib/auth/auth";
import { getCashCategories } from "./actions";
import { CategoriesList } from "./components/CategoriesList";
import { CategoryForm } from "./components/CategoryForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function CashCategoriesPage() {
  const [categories, auth] = await Promise.all([getCashCategories(), resolveActor()]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhóm thu chi"
        subtitle="Đặt tên các nhóm chi và thu. Nhóm đã có dòng sổ thì ngừng dùng, không xoá."
        actions={<CategoryForm />}
      />
      <CategoriesList categories={categories} canDelete={canDelete} />
    </div>
  );
}
