"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import type { DBDashboardSettings, DBProduct, DBProductType } from "@/types/db";
import { saveDashboardSettings } from "../actions";

interface DashboardSettingsFormProps {
  settings: DBDashboardSettings;
  products: DBProduct[];
  types: DBProductType[];
  isOwner?: boolean;
}

const KNOWN_FIELDS = new Set([
  "stale_stocktake_days",
  "open_stocktake_days",
  "reminder_start_day",
  "food_product_ids",
  "topping_type_id",
]);

export function DashboardSettingsForm({
  settings,
  products,
  types,
  isOwner = true,
}: DashboardSettingsFormProps) {
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [toppingTypeId, setToppingTypeId] = useState(
    settings.topping_type_id ?? ""
  );
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>(
    settings.food_product_ids ?? []
  );

  const savedFoodIds = new Set(settings.food_product_ids ?? []);
  const foodProducts = products
    .filter((p) => p.status === "ACTIVE" || savedFoodIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setLoading(true);
    setGeneralError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    try {
      const result = await saveDashboardSettings(formData);

      if (result.error) {
        savingRef.current = false;
        setLoading(false);
        const field = typeof result.field === "string" ? result.field : "";
        if (field && KNOWN_FIELDS.has(field)) {
          setFieldErrors({ [field]: result.error });
        } else {
          setGeneralError(result.error);
        }
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      savingRef.current = false;
      setLoading(false);
      setGeneralError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {generalError && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20"
          >
            {generalError}
          </div>
        )}

        <div
          data-testid="form-fields"
          className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"
        >
          <Field
            label="Báo lâu chưa kiểm kê sau (ngày)"
            htmlFor={`${formId}-stale_stocktake_days`}
          >
            <NumberInput
              id={`${formId}-stale_stocktake_days`}
              name="stale_stocktake_days"
              decimals={0}
              defaultValue={settings.stale_stocktake_days}
              min={1}
              max={365}
              required
              hint="Từ 1 đến 365"
              error={fieldErrors.stale_stocktake_days}
              onValueChange={() => clearFieldError("stale_stocktake_days")}
            />
          </Field>

          <Field
            label="Báo phiếu kiểm kê mở dở sau (ngày)"
            htmlFor={`${formId}-open_stocktake_days`}
          >
            <NumberInput
              id={`${formId}-open_stocktake_days`}
              name="open_stocktake_days"
              decimals={0}
              defaultValue={settings.open_stocktake_days}
              min={1}
              max={365}
              required
              hint="Từ 1 đến 365"
              error={fieldErrors.open_stocktake_days}
              onValueChange={() => clearFieldError("open_stocktake_days")}
            />
          </Field>

          <Field
            label="Ngày bắt đầu nhắc khoản chi hằng tháng"
            htmlFor={`${formId}-reminder_start_day`}
          >
            <NumberInput
              id={`${formId}-reminder_start_day`}
              name="reminder_start_day"
              decimals={0}
              defaultValue={settings.reminder_start_day}
              min={1}
              max={28}
              required
              hint="Từ 1 đến 28"
              error={fieldErrors.reminder_start_day}
              onValueChange={() => clearFieldError("reminder_start_day")}
            />
          </Field>

          <Field
            label="Cột topping mua riêng"
            htmlFor={`${formId}-topping_type_id`}
            error={fieldErrors.topping_type_id}
          >
            <Select
              id={`${formId}-topping_type_id`}
              name="topping_type_id"
              value={toppingTypeId}
              onChange={(e) => {
                setToppingTypeId(e.target.value);
                setFieldErrors((prev) => {
                  const copy = { ...prev };
                  delete copy.topping_type_id;
                  return copy;
                });
              }}
              invalid={Boolean(fieldErrors.topping_type_id)}
            >
              <option value="">Không hiện</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Món làm cột đồ ăn"
              htmlFor={`${formId}-food_product_ids`}
              hint="Mỗi món chọn là một cột trong bảng 7 ngày."
              error={fieldErrors.food_product_ids}
            >
              <div
                id={`${formId}-food_product_ids`}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1"
              >
                {foodProducts.map((p) => {
                  const isChecked = selectedFoodIds.includes(p.id);
                  const checkboxId = `${formId}-food-${p.id}`;
                  const isInactive = p.status !== "ACTIVE";
                  return (
                    <label
                      key={p.id}
                      htmlFor={checkboxId}
                      className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-lg border border-border hover:bg-surface-secondary/40 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        id={checkboxId}
                        name="food_product_ids"
                        value={p.id}
                        aria-label={p.name}
                        checked={isChecked}
                        disabled={!isOwner}
                        onChange={() => {
                          setSelectedFoodIds((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id]
                          );
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.food_product_ids;
                            return copy;
                          });
                        }}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text-primary">
                        {p.name}
                        {isInactive && (
                          <span className="ml-1 text-xs text-danger font-medium"> (không còn bán)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-border">
          {!isOwner && (
            <p className="text-sm text-text-muted mr-auto">Chỉ chủ quán sửa được mục này</p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/admin")}
            className="w-full sm:w-auto"
          >
            Bỏ
          </Button>
          {isOwner && (
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full sm:w-auto"
            >
              Lưu
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
