"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addSupplier, editSupplier } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
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
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20 font-medium"
          >
            {error}
          </div>
        )}

        <Field label="Tên nhà cung cấp" htmlFor={`${formId}-name`} required>
          <TextInput
            id={`${formId}-name`}
            type="text"
            name="name"
            required
            maxLength={120}
            defaultValue={initialData?.name ?? initialName}
            example="Cửa hàng ABC"
          />
        </Field>

        <Field label="Số điện thoại" htmlFor={`${formId}-phone`}>
          <TextInput
            id={`${formId}-phone`}
            type="tel"
            name="phone"
            defaultValue={initialData?.phone}
            example="0901234567"
          />
        </Field>

        <Field label="Mã số thuế" htmlFor={`${formId}-tax-id`}>
          <TextInput
            id={`${formId}-tax-id`}
            type="text"
            name="tax_id"
            defaultValue={initialData?.tax_id}
            example="0123456789"
          />
        </Field>

        <Field label="Địa chỉ" htmlFor={`${formId}-address`}>
          <TextInput
            id={`${formId}-address`}
            type="text"
            name="address"
            defaultValue={initialData?.address}
            example="123 Đường ABC, Quận XYZ"
          />
        </Field>

        <Field label="Ghi chú / links" htmlFor={`${formId}-links`}>
          <textarea
            id={`${formId}-links`}
            name="links"
            rows={3}
            defaultValue={initialData?.links}
            className="w-full rounded-button bg-surface-card border border-border px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50"
            placeholder="Ví dụ: https://facebook.com/nhacungcap"
          />
        </Field>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto"
          >
            {isEdit ? "Bỏ thay đổi" : "Bỏ"}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full sm:w-auto"
          >
            {isEdit ? "Lưu thay đổi" : "Lưu nhà cung cấp"}
          </Button>
        </div>
      </form>
    </div>
  );
}
