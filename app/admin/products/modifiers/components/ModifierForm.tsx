"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveModifierAction } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import type { DBModifier } from "@/types/db";

interface ModifierFormProps {
  initialData?: DBModifier;
}

export function ModifierForm({ initialData }: ModifierFormProps) {
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const [groupName, setGroupName] = useState(initialData?.group_name || "Thêm Topping");
  const [price, setPrice] = useState(initialData?.price || "0");

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

    // docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
    // section B: revalidatePath (in saveModifierAction) marks the server
    // cache stale but does not repaint this already-open page.
    const res = await saveModifierAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setPrice("0");
      }
      router.refresh();
    }
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)} className="mr-2">Sửa</Button>
      ) : (
        <Button variant="primary" onClick={() => setIsOpen(true)}><Plus size={16} className="mr-2" /> Thêm Tùy Chọn</Button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Tùy Chọn" : "Thêm Tùy Chọn Mới"}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Hủy</Button>
            <LoadingButton
              type="submit"
              form="modifier-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Tùy Chọn"}
            </LoadingButton>
          </>
        }
      >
        <form id="modifier-form" action={handleSubmit} className="space-y-4">
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
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
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
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
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
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: Trân châu trắng, Size L..."
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}
