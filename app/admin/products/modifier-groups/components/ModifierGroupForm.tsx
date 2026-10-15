"use client";

import { useState, useId, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  saveModifierGroup,
  updateModifierGroup,
} from "@/app/admin/products/modifier-groups/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { Alert } from "@/components/ui/Alert";
import type { DBModifierGroup, DBProductCategory, DBProduct } from "@/types/db";

export interface ModifierGroupFormProps {
  initialData?: DBModifierGroup;
  initialProductIds?: string[];
  categories: DBProductCategory[];
  products: DBProduct[];
  returnTo?: string;
}

export function ModifierGroupForm({
  initialData,
  initialProductIds = [],
  categories,
  products,
  returnTo = "/admin/products/modifier-groups",
}: ModifierGroupFormProps) {
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const [sortOrder, setSortOrder] = useState<string>(
    initialData?.sort_order !== undefined ? String(initialData.sort_order) : "50"
  );
  const [selectionMode, setSelectionMode] = useState<"ONE" | "MANY">(
    initialData?.selection_mode || "MANY"
  );
  const [maxTotal, setMaxTotal] = useState<string>(
    initialData?.max_total !== undefined && initialData?.max_total !== null
      ? String(initialData.max_total)
      : ""
  );
  const [allowStandalone, setAllowStandalone] = useState<boolean>(
    initialData?.allow_standalone ?? false
  );

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    () => initialProductIds || []
  );

  const isOne = selectionMode === "ONE";
  const isMany = selectionMode === "MANY";

  // Group products by category
  const groupedProducts = useMemo(() => {
    return categories
      .map((cat) => {
        const catProducts = products.filter(
          (p) => p.category_id === cat.id
        );
        return {
          category: cat,
          products: catProducts,
          productIds: catProducts.map((p) => p.id),
        };
      })
      .filter((group) => group.products.length > 0);
  }, [categories, products]);

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleToggleCategory = (catProductIds: string[]) => {
    const allSelected = catProductIds.every((id) =>
      selectedProductIds.includes(id)
    );
    if (allSelected) {
      setSelectedProductIds((prev) =>
        prev.filter((id) => !catProductIds.includes(id))
      );
    } else {
      setSelectedProductIds((prev) =>
        Array.from(new Set([...prev, ...catProductIds]))
      );
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nhập tên nhóm");
      return;
    }

    const orderNum = Number(sortOrder);
    if (isNaN(orderNum) || orderNum < 1 || orderNum > 99) {
      setError("Thứ tự hiện từ 1 đến 99");
      return;
    }

    if (isMany && maxTotal !== "") {
      const maxNum = Number(maxTotal);
      if (isNaN(maxNum) || maxNum < 1 || maxNum > 20) {
        setError("Tối đa từ 1 đến 20 phần");
        return;
      }
    }

    savingRef.current = true;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    if (isEdit && initialData) {
      formData.set("id", initialData.id);
    }
    formData.set("name", trimmedName);
    formData.set("sort_order", sortOrder);
    formData.set("selection_mode", selectionMode);

    if (isMany) {
      if (maxTotal.trim() !== "") {
        formData.set("max_total", maxTotal.trim());
      }
      if (allowStandalone) {
        formData.set("allow_standalone", "on");
      }
    }

    selectedProductIds.forEach((pid) => {
      formData.append("product_ids", pid);
    });

    const fn = isEdit ? updateModifierGroup : saveModifierGroup;
    try {
      const res = await fn(formData);
      if (res?.error) {
        savingRef.current = false;
        setLoading(false);
        setError(res.error);
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      savingRef.current = false;
      setLoading(false);
      setError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        <div
          data-testid="form-fields"
          className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"
        >
          <Field label="Tên nhóm" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Mức đường"
              example="Mức đường"
            />
          </Field>

          <Field label="Thứ tự hiện" htmlFor={`${formId}-sort_order`} required hint="Từ 1 đến 99, số nhỏ hiện trước">
            <NumberInput
              id={`${formId}-sort_order`}
              name="sort_order"
              required
              min={1}
              max={99}
              decimals={0}
              example="50"
              value={sortOrder === "" ? null : Number(sortOrder)}
              onValueChange={(v) => setSortOrder(v === null ? "" : String(v))}
            />
          </Field>

          <Field label="Kiểu chọn" htmlFor={`${formId}-selection_mode`}>
            <Select
              id={`${formId}-selection_mode`}
              name="selection_mode"
              value={selectionMode}
              onChange={(e) =>
                setSelectionMode(e.target.value as "ONE" | "MANY")
              }
            >
              <option value="MANY">Chọn nhiều</option>
              <option value="ONE">Chọn một</option>
            </Select>
          </Field>

          {isMany && (
            <Field
              label="Tối đa mấy phần"
              htmlFor={`${formId}-max_total`}
              hint="Từ 1 đến 20 phần, để trống nếu không giới hạn"
            >
              <NumberInput
                id={`${formId}-max_total`}
                name="max_total"
                min={1}
                max={20}
                decimals={0}
                example="3"
                value={maxTotal === "" ? null : Number(maxTotal)}
                onValueChange={(v) => setMaxTotal(v === null ? "" : String(v))}
              />
            </Field>
          )}

          {isMany && (
            <div className="flex items-center pt-2 md:pt-7 col-span-1 md:col-span-2">
              <label
                htmlFor={`${formId}-allow_standalone`}
                className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary min-h-[44px] md:min-h-[40px]"
              >
                <input
                  type="checkbox"
                  id={`${formId}-allow_standalone`}
                  name="allow_standalone"
                  checked={allowStandalone}
                  onChange={(e) => setAllowStandalone(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                />
                <span>Cho bán riêng (tuỳ chọn trong nhóm có thể được tạo thành món bán độc lập)</span>
              </label>
            </div>
          )}
        </div>

        {/* Section: Món áp dụng */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Món áp dụng ({selectedProductIds.length})
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Chọn các món áp dụng nhóm tuỳ chọn này trên máy bán hàng.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {groupedProducts.map((group) => {
              const allGroupSelected = group.productIds.every((id) =>
                selectedProductIds.includes(id)
              );

              return (
                <div
                  key={group.category.id}
                  className="bg-page rounded-xl border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="font-semibold text-sm text-text-primary">
                      {group.category.name} ({group.products.length})
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleToggleCategory(group.productIds)}
                      className="text-xs min-h-[36px] h-9 px-3"
                    >
                      {allGroupSelected ? "Bỏ chọn nhóm" : "Chọn cả nhóm"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {group.products.map((p) => {
                      const isChecked = selectedProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          htmlFor={`${formId}-prod-${p.id}`}
                          className={`flex items-center gap-2 cursor-pointer text-sm font-normal p-2.5 rounded-lg border transition-colors min-h-[44px] md:min-h-[40px] ${
                            isChecked
                              ? "bg-primary-soft/30 border-primary text-text-primary"
                              : "bg-surface-card border-border text-text-secondary hover:border-border-hover"
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`${formId}-prod-${p.id}`}
                            value={p.id}
                            checked={isChecked}
                            onChange={() => handleToggleProduct(p.id)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
            {isEdit ? "Cập nhật" : "Tạo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
