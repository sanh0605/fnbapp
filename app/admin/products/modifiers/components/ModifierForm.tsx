"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveModifierAction } from "@/app/admin/products/modifiers/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { Alert } from "@/components/ui/Alert";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { safeReturnTo } from "@/lib/shared/return-to";
import type { DBModifier, DBModifierGroup } from "@/types/db";
import { StandaloneToppingSwitch } from "./StandaloneToppingSwitch";

interface ModifierFormProps {
  initialData?: DBModifier;
  // Current status of initialData.product_id, when linked -- passed down
  // from page lookup rather than re-fetched here.
  productStatus?: string;
  returnTo?: string;
  groups?: DBModifierGroup[];
}

export function ModifierForm({ initialData, productStatus, returnTo: rawReturnTo, groups = [] }: ModifierFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/products/modifiers");
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const defaultGroupId = groups[0]?.id || initialData?.group_id || "";
  const [groupId, setGroupId] = useState(initialData?.group_id || defaultGroupId);
  const [price, setPrice] = useState(initialData?.price !== undefined ? String(initialData.price) : "");
  const [isDefault, setIsDefault] = useState(Boolean(initialData?.is_default));
  const [maxQty, setMaxQty] = useState(
    initialData?.max_qty !== undefined && initialData?.max_qty !== null ? String(initialData.max_qty) : ""
  );

  const effectiveGroupId = groupId || defaultGroupId;
  const selectedGroup = groups.find((g) => g.id === effectiveGroupId);
  const isOne = selectedGroup?.selection_mode === "ONE";
  const isMany = selectedGroup ? selectedGroup.selection_mode === "MANY" : true;
  const allowStandalone = Boolean(selectedGroup?.allow_standalone);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (!name || !effectiveGroupId) {
      setError("Vui lòng nhập đầy đủ thông tin");
      setLoading(false);
      return;
    }

    formData.append("is_edit", String(isEdit));
    if (isEdit) formData.append("id", initialData!.id);
    formData.append("name", name);
    formData.append("group_id", effectiveGroupId);
    formData.append("price", price);

    if (isOne) {
      if (isDefault) {
        formData.append("is_default", "on");
      }
    } else {
      if (maxQty !== "" && maxQty !== null && maxQty !== undefined) {
        formData.append("max_qty", maxQty);
      }
    }

    const res = await saveModifierAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(new FormData(e.currentTarget)); }} className="space-y-4">
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Nhóm tuỳ chọn" htmlFor={`${formId}-groupId`}>
            <Select
              id={`${formId}-groupId`}
              value={effectiveGroupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Giá thêm" htmlFor={`${formId}-price`}>
            <NumberInput
              id={`${formId}-price`}
              decimals={0}
              unit="đ"
              min={0}
              required
              example="5,000"
              value={price === "" ? null : Number(price)}
              onValueChange={(v) => setPrice(v === null ? "" : String(v))}
            />
          </Field>

          <Field label="Tên tuỳ chọn" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              example="Trân châu trắng"
            />
          </Field>

          {isOne && (
            <div className="flex items-center pt-2 md:pt-7">
              <label
                htmlFor={`${formId}-is_default`}
                className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary min-h-[48px] md:min-h-[40px]"
              >
                <input
                  type="checkbox"
                  id={`${formId}-is_default`}
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                />
                <span>Có sẵn (mặc định chọn khi mở món)</span>
              </label>
            </div>
          )}

          {isMany && (
            <Field
              label="Tối đa mỗi món"
              htmlFor={`${formId}-max_qty`}
              hint="Để trống nếu không giới hạn cho mỗi món"
            >
              <NumberInput
                id={`${formId}-max_qty`}
                decimals={0}
                min={1}
                max={20}
                example="2"
                value={maxQty === "" ? null : Number(maxQty)}
                onValueChange={(v) => setMaxQty(v === null ? "" : String(v))}
              />
            </Field>
          )}
        </div>

        {/* BR-CATALOG-003.
            Its own labelled section, visually separated -- this switch
            fires its own independent action on click, never bundled into
            the Cập nhật submit above. StandaloneToppingSwitch itself renders
            null outside a group with allow_standalone. */}
        {isEdit && allowStandalone && (
          <div className="pt-4 mt-2 border-t border-border flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-text-primary">Bán độc lập</div>
              <div className="text-xs text-text-muted mt-0.5">
                Bật/tắt áp dụng ngay, không cần bấm Cập nhật. Bấm Bỏ không huỷ được thao tác này.
              </div>
            </div>
            <StandaloneToppingSwitch
              modifierId={initialData!.id}
              modifierName={initialData!.name}
              price={initialData!.price}
              productId={initialData!.product_id}
              productStatus={productStatus}
              allowStandalone={allowStandalone}
            />
          </div>
        )}

        <FormActionBar
          mode={isEdit ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
