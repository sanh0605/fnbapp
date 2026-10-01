"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addUnit, updateUnit, deleteUnit } from "@/app/admin/inventory/actions";
import { alert, confirm } from "@/lib/shared/dialog";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";

interface UnitFormProps {
  initialData?: any;
  returnTo?: string;
}

export function UnitForm({ initialData, returnTo: rawReturnTo }: UnitFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/units");
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    let res;
    if (isEdit) {
      formData.append("id", initialData.id);
      res = await updateUnit(formData);
    } else {
      res = await addUnit(formData);
    }
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: res.error, variant: "danger" });
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
            Tên đơn vị (VD: gram, hộp)
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            name="name"
            defaultValue={initialData?.name}
            required
            className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-focus-ring outline-none text-text-primary"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-text-secondary mb-1">
            Ghi chú thêm
          </label>
          <input
            id={`${formId}-description`}
            type="text"
            name="description"
            defaultValue={initialData?.description}
            className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-focus-ring outline-none text-text-primary"
            placeholder="Không bắt buộc"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center"
          >
            Bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-primary text-on-primary rounded-button font-medium hover:bg-primary-hover transition disabled:opacity-50"
          >
            {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DeleteBtn({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (await confirm({ title: "Xác nhận xóa", message: "Xác nhận xoá đơn vị này?", variant: "danger" })) {
      setLoading(true);
      const fd = new FormData();
      fd.append("id", id);
      const res = await deleteUnit(fd);
      setLoading(false);
      // section A4: this is the exact site the owner hit -- Combo 2's
      // delete was refused server-side and nothing here ever read the
      // result. res.error is now a real Vietnamese sentence naming the
      // unit and what is using it (app/admin/inventory/actions.ts's
      // deleteUnit, section A3/A7), not a raw code or silence.
      if (res?.error) {
        await alert({ title: "Không xoá được", message: res.error, variant: "danger" });
        return;
      }
      router.refresh();
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={loading}
      className="text-danger hover:text-danger-active text-sm font-medium disabled:opacity-50"
    >
      {loading ? "..." : "Xoá"}
    </button>
  );
}
