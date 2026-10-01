"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addSupplier, editSupplier } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { confirm } from "@/lib/shared/dialog";
import { safeReturnTo, safePoReturnTo } from "./return-to";
import type { DBSupplier } from "@/types/db";

interface SupplierFormProps {
  initialData?: DBSupplier;
  returnTo?: string;
  returnMode?: "list" | "po";
  initialName?: string;
}

export function SupplierForm({
  initialData,
  returnTo: rawReturnTo,
  returnMode = "list",
  initialName,
}: SupplierFormProps) {
  const returnTo = returnMode === "po" ? safePoReturnTo(rawReturnTo) : safeReturnTo(rawReturnTo);

  const isEdit = !!initialData;
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // section B: revalidatePath (in addSupplier/editSupplier) marks the
  // server cache stale but does not repaint this already-open page.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    const fn = isEdit ? editSupplier : addSupplier;
    let res = await fn(formData);
    if ((res as any)?.needsDuplicateWarning) {
      const approved = await confirm({
        title: "Tên gần giống một mục đã có",
        message: (res as any).needsDuplicateWarning.message,
        okText: "Món khác",
        cancelText: "Tôi gõ nhầm",
        variant: "warning",
      });
      if (approved) {
        formData.append("duplicate_warning_confirmed", "true");
        res = await fn(formData);
      } else {
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      let targetUrl = returnTo;
      if (returnMode === "po" && (res as any)?.id) {
        const sep = returnTo.includes("?") ? "&" : "?";
        targetUrl = `${returnTo}${sep}newSupplier=${encodeURIComponent(String((res as any).id))}`;
      }
      router.push(targetUrl);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border overflow-hidden">
      <form onSubmit={handleSubmit} className="divide-y divide-border">
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="p-4 bg-danger/10 text-danger text-sm font-medium"
          >
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-4 p-4 text-sm items-center">
          <label
            htmlFor={`${formId}-name`}
            className="text-text-muted font-medium md:text-text-secondary"
          >
            Tên Nhà Cung Cấp
          </label>
          <div>
            <input
              id={`${formId}-name`}
              type="text"
              name="name"
              required
              maxLength={120}
              defaultValue={initialData?.name ?? initialName}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
              placeholder="VD: Cửa hàng ABC"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-4 p-4 text-sm items-center">
          <label
            htmlFor={`${formId}-phone`}
            className="text-text-muted font-medium md:text-text-secondary"
          >
            Số Điện Thoại
          </label>
          <div>
            <input
              id={`${formId}-phone`}
              type="tel"
              name="phone"
              defaultValue={initialData?.phone}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
              placeholder="VD: 0901234567"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-4 p-4 text-sm items-center">
          <label
            htmlFor={`${formId}-tax-id`}
            className="text-text-muted font-medium md:text-text-secondary"
          >
            Mã Số Thuế
          </label>
          <div>
            <input
              id={`${formId}-tax-id`}
              type="text"
              name="tax_id"
              defaultValue={initialData?.tax_id}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
              placeholder="VD: 0123456789"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-4 p-4 text-sm items-center">
          <label
            htmlFor={`${formId}-address`}
            className="text-text-muted font-medium md:text-text-secondary"
          >
            Địa Chỉ
          </label>
          <div>
            <input
              id={`${formId}-address`}
              type="text"
              name="address"
              defaultValue={initialData?.address}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
              placeholder="VD: 123 Đường ABC, Quận XYZ"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-4 p-4 text-sm items-start">
          <label
            htmlFor={`${formId}-links`}
            className="text-text-muted font-medium md:text-text-secondary pt-2"
          >
            Ghi chú / Links
          </label>
          <div>
            <textarea
              id={`${formId}-links`}
              name="links"
              rows={3}
              defaultValue={initialData?.links}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
              placeholder="Các liên kết hoặc ghi chú thêm..."
            />
          </div>
        </div>

        <div className="p-4 bg-surface-secondary/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center min-h-[44px] flex items-center justify-center border border-border"
          >
            {isEdit ? "Bỏ thay đổi" : "Bỏ"}
          </button>
          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang lưu..."
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isEdit ? "Lưu thay đổi" : "Lưu nhà cung cấp"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
