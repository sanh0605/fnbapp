"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashTransfer, updateCashTransfer } from "../actions";
import { Button } from "@/components/ui/Button";
import { DayInput } from "@/components/ui/DayInput";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { safeReturnTo } from "./return-to";
import type { DBBankAccount, DBCashTransfer } from "@/types/db";

interface CashTransferFormProps {
  transfer?: DBCashTransfer;
  accounts: DBBankAccount[];
  today?: string;
  returnTo?: string;
}

export function CashTransferForm({
  transfer,
  accounts,
  today,
  returnTo: rawReturnTo,
}: CashTransferFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/finance");
  const isEdit = !!transfer;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(transfer?.transfer_date ?? today ?? "");
  const [dayError, setDayError] = useState("");

  const accountOptions = accounts.filter(
    (a) =>
      a.status === "ACTIVE" ||
      a.id === transfer?.from_account_id ||
      a.id === transfer?.to_account_id,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!day || day === "invalid") {
      setDayError("Ngày không hợp lệ");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const from = ((formData.get("from") as string) || "").trim();
    const to = ((formData.get("to") as string) || "").trim();

    if (!from) {
      setError("Chọn nơi chuyển");
      return;
    }
    if (!to) {
      setError("Chọn nơi nhận");
      return;
    }
    if (from === to) {
      setError("Nơi chuyển và nơi nhận phải khác nhau");
      return;
    }

    setLoading(true);
    setError(null);

    if (isEdit && transfer) formData.set("id", transfer.id);
    const result = isEdit
      ? await updateCashTransfer(formData)
      : await addCashTransfer(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  const defaultFrom = transfer ? (transfer.from_account_id ?? "CASH") : "";
  const defaultTo = transfer ? (transfer.to_account_id ?? "CASH") : "";

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20"
          >
            {error}
          </div>
        )}

        <div>
          <DayInput
            label="Ngày"
            value={day}
            onChange={(v) => {
              setDay(v);
              setDayError("");
            }}
            error={dayError}
          />
          <input type="hidden" name="transfer_date" value={day} />
        </div>

        <Field label="Số tiền (đồng)" htmlFor={`${formId}-amount`} required>
          <MoneyInput
            id={`${formId}-amount`}
            name="amount"
            required
            defaultValue={transfer?.amount}
            example="500,000"
          />
        </Field>

        <Field label="Từ" htmlFor={`${formId}-from`} required>
          <Select
            id={`${formId}-from`}
            name="from"
            required
            defaultValue={defaultFrom}
          >
            <option value="" disabled>
              Chọn nơi chuyển
            </option>
            <option value="CASH">Tiền mặt (két)</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Đến" htmlFor={`${formId}-to`} required>
          <Select
            id={`${formId}-to`}
            name="to"
            required
            defaultValue={defaultTo}
          >
            <option value="" disabled>
              Chọn nơi nhận
            </option>
            <option value="CASH">Tiền mặt (két)</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ghi chú (không bắt buộc)" htmlFor={`${formId}-note`}>
          <TextInput
            id={`${formId}-note`}
            type="text"
            name="note"
            defaultValue={transfer?.note ?? ""}
            placeholder="Ví dụ: nộp tiền vào tài khoản"
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
            {isEdit ? "Cập nhật" : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
