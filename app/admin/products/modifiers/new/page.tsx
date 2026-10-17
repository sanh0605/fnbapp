import { findAll } from "@/lib/db/tables";
import type { DBModifierGroup } from "@/types/db";
import { ModifierForm } from "@/app/admin/products/modifiers/components/ModifierForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewModifierPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const groups = (await findAll("Modifier_Groups")) as DBModifierGroup[];
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/modifiers");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Topping & tuỳ chọn"
        title="Tạo tuỳ chọn"
        subtitle="Thêm tuỳ chọn mới vào nhóm tuỳ chọn của món."
      />
      <ModifierForm groups={groups} returnTo={returnTo} />
    </DetailFrame>
  );
}
