"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { NumberInput } from "@/components/ui/NumberInput";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { createAssetBand } from "../actions";

// 2026-08-23, section 2: "A table the owner cannot add a row to is not the
// settings screen CLAUDE.md "Viết code" requires; it is a constant with an
// edit box."
// Wave 4: full-page form instead of modal, returns to list view on submit/cancel.
export function AddBandForm({ returnTo: rawReturnTo }: { returnTo?: string } = {}) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/asset-bands");
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const res = await createAssetBand(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}
        <p className="text-xs text-text-muted">
          Khung mới phải khớp khít với các khung hiện có -- không chồng lấn, không để trống khoảng. Thường cần thu hẹp một khung liền kề trước.
        </p>
        <Field
          label="Giá thấp nhất (đ, tính theo đơn giá 1 cái)"
          htmlFor={`${formId}-min`}
        >
          <NumberInput
            id={`${formId}-min`}
            name="min_unit_price"
            decimals={0}
            unit="đ"
            min={0}
            example="150,000"
          />
        </Field>
        <Field
          label="Giá cao nhất (đ, không bao gồm giá trị này)"
          htmlFor={`${formId}-max`}
        >
          <NumberInput
            id={`${formId}-max`}
            name="max_unit_price"
            decimals={0}
            unit="đ"
            min={0}
            example="2,000,000"
            hint="Để trống nếu không giới hạn trên"
          />
        </Field>
        <Field
          label="Số tháng khấu hao"
          htmlFor={`${formId}-term`}
        >
          <NumberInput
            id={`${formId}-term`}
            name="term_months"
            decimals={0}
            min={1}
            example="12"
          />
        </Field>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto"
          >
            Bỏ
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
