"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveModifierAction } from "@/app/admin/products/modifiers/actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import type { DBModifier } from "@/types/db";
import { StandaloneToppingSwitch } from "./StandaloneToppingSwitch";

interface ModifierFormProps {
  initialData?: DBModifier;
  // Current status of initialData.product_id, when linked -- passed down
  // from page lookup rather than re-fetched here.
  productStatus?: string;
  returnTo?: string;
}

export function ModifierForm({ initialData, productStatus, returnTo: rawReturnTo }: ModifierFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/products/modifiers");
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const [groupName, setGroupName] = useState(initialData?.group_name || "Thêm Topping");
  const [price, setPrice] = useState(initialData?.price !== undefined ? String(initialData.price) : "0");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (!name || !groupName) {
      setError("Vui lòng nhập đầy đủ thông tin");
      setLoading(false);
      return;
    }

    formData.append("is_edit", String(isEdit));
    if (isEdit) formData.append("id", initialData!.id);
    formData.append("name", name);
    formData.append("group_name", groupName);
    formData.append("price", price);

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
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-groupName`} className="block text-sm font-medium text-text-secondary mb-1">Nhóm Tùy Chọn</label>
            <select
              id={`${formId}-groupName`}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
            >
              <option value="Thêm Topping">Thêm Topping</option>
              <option value="Chọn Size">Chọn Size</option>
              <option value="Chọn Đường">Chọn Đường</option>
              <option value="Chọn Đá">Chọn Đá</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-price`} className="block text-sm font-medium text-text-secondary mb-1">Giá thêm (đ)</label>
            <input
              id={`${formId}-price`}
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">Tên Tùy Chọn</label>
          <input
            id={`${formId}-name`}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            placeholder="VD: Trân châu trắng, Size L..."
          />
        </div>

        {/* BR-CATALOG-003.
            Its own labelled section, visually separated -- this switch
            fires its own independent action on click, never bundled into
            the Cập nhật submit above. StandaloneToppingSwitch itself renders
            null outside that group (state d), and a modifier not yet
            saved has no id to link anything to. */}
        {isEdit && initialData!.group_name === "Thêm Topping" && (
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
              groupName={initialData!.group_name}
              price={initialData!.price}
              productId={initialData!.product_id}
              productStatus={productStatus}
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center min-h-[44px]"
          >
            Bỏ
          </button>
          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang lưu..."
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isEdit ? "Cập nhật" : "Lưu Tùy Chọn"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
