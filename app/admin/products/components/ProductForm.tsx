"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/admin/products/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { Alert } from "@/components/ui/Alert";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Plus } from "lucide-react";
import { confirm } from "@/lib/shared/dialog";
import { safeReturnTo } from "@/lib/shared/return-to";

interface ProductFormProps {
  categories: Array<{ id: string; name: string }>;
  initialData?: any;
  returnTo?: string;
  optionGroups?: Array<{ id: string; name: string; status?: string }>;
  selectedOptionGroupIds?: string[];
}

export default function ProductForm({
  categories,
  initialData,
  returnTo: rawReturnTo,
  optionGroups,
  selectedOptionGroupIds: selectedOptionGroupIdsProp,
}: ProductFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/products");
  const router = useRouter();
  const isEdit = !!initialData;
  // BR-CATALOG-003's price sync (migration 0098) makes the Topping & Tuỳ
  // chọn screen the one edit point for a topping linked to an ACTIVE
  // modifier -- this form must stop being a second editor for that price.
  const priceReadOnly = isEdit && !!initialData?.isLinkedTopping;
  const formId = useId();
  const [loading, setLoading] = useState(false);

  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [name, setName] = useState(initialData?.name || "");
  const [selectedOptionGroupIds, setSelectedOptionGroupIds] = useState<string[]>(
    () => selectedOptionGroupIdsProp || []
  );

  // variants format: { id?: string, size_name: string, price: number | string }
  const [variants, setVariants] = useState<any[]>(
    initialData?.variants || [{ size_name: "Mặc định", price: "" }]
  );
  const [priceErrors, setPriceErrors] = useState<Record<number, string>>({});
  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setCategoryError(null);
    setSaveError(null);

    let hasFieldError = false;
    if (!name.trim()) {
      setNameError("Vui lòng nhập tên món");
      hasFieldError = true;
    }
    if (!categoryId) {
      setCategoryError("Vui lòng chọn nhóm món");
      hasFieldError = true;
    }
    if (hasFieldError) {
      return;
    }
    if (variants.length === 0) {
      setSaveError("Phải có ít nhất 1 size.");
      return;
    }

    const newPriceErrors: Record<number, string> = {};
    let hasPriceError = false;
    variants.forEach((v, idx) => {
      if (v.price === "" || v.price === null || v.price === undefined) {
        newPriceErrors[idx] = "Cần nhập số.";
        hasPriceError = true;
      }
    });
    if (hasPriceError) {
      setPriceErrors(newPriceErrors);
      return;
    }

    setLoading(true);
    const formData = new FormData();
    if (isEdit) formData.append("id", initialData.id);
    formData.append("category_id", categoryId);
    formData.append("name", name);
    formData.append("variants_json", JSON.stringify(variants));
    formData.append("option_group_ids_sent", "1");
    selectedOptionGroupIds.forEach((gid) => {
      formData.append("option_group_ids", gid);
    });

    try {
      let res = await saveProduct(formData);
      // Batch 1 follow-up, level 2 (docs/02-rules/business-rules/catalog.md BR-CATALOG-001): a
      // near-match warning, not a refusal -- ask whether it is really a
      // different item, resubmit once on "món khác", stay on the form with
      // nothing saved on "tôi gõ nhầm".
      if ((res as any).needsDuplicateWarning) {
        const approved = await confirm({
          title: "Tên gần giống một mục đã có",
          message: (res as any).needsDuplicateWarning.message,
          okText: "Món khác",
          cancelText: "Tôi gõ nhầm",
          variant: "warning",
        });
        if (approved) {
          formData.append("duplicate_warning_confirmed", "true");
          res = await saveProduct(formData);
        } else {
          setLoading(false);
          return;
        }
      }
      setLoading(false);

      if (res.success) {
        router.push(returnTo);
        router.refresh();
      } else {
        setSaveError(res.error || "Không lưu được.");
      }
    } catch {
      setLoading(false);
      setSaveError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
    }
  };

  // --- HANDLERS FOR VARIANTS ---
  const addVariant = () => {
    setVariants([...variants, { size_name: "", price: "" }]);
  };
  const updateVariant = (vIndex: number, field: string, value: any) => {
    const newVars = [...variants];
    newVars[vIndex][field] = value;
    setVariants(newVars);
    if (field === "price") {
      setPriceErrors((prev) => {
        if (!prev[vIndex]) return prev;
        const next = { ...prev };
        delete next[vIndex];
        return next;
      });
    }
  };
  const removeVariant = (vIndex: number) => {
    setVariants(variants.filter((_, i) => i !== vIndex));
    setPriceErrors((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([idxStr, err]) => {
        const idx = Number(idxStr);
        if (idx < vIndex) next[idx] = err;
        else if (idx > vIndex) next[idx - 1] = err;
      });
      return next;
    });
  };

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form id={isEdit ? `editProd-${initialData.id}` : "addProd"} onSubmit={handleSubmit} className="space-y-6">
        <div data-testid="form-layout" className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          {/* THÔNG TIN CHUNG */}
          <div className="bg-transparent md:bg-page p-0 md:p-5 rounded-none md:rounded-xl border-0 md:border border-border">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
              Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <Field
                label="Tên món"
                htmlFor={`${formId}-name`}
                required
                error={nameError ?? undefined}
              >
                <TextInput
                  id={`${formId}-name`}
                  required
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  example="Cà phê sữa đá"
                />
              </Field>
              <Field
                label="Nhóm món"
                htmlFor={`${formId}-category-id`}
                required
                error={categoryError ?? undefined}
              >
                <Select
                  id={`${formId}-category-id`}
                  required
                  value={categoryId}
                  onChange={e => {
                    setCategoryId(e.target.value);
                    if (categoryError) setCategoryError(null);
                  }}
                >
                  <option value="">-- Chọn nhóm --</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          {/* VARIANTS */}
          <div className="bg-transparent md:bg-page p-0 md:p-5 rounded-none md:rounded-xl border-0 md:border border-border">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 whitespace-nowrap">
                <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0">2</span>
                Các size
              </h3>
              {!priceReadOnly && (
              <Button
                variant="secondary"
                type="button"
                onClick={(e) => {
                  e.currentTarget.dispatchEvent(new Event("change", { bubbles: true }));
                  addVariant();
                }}
                className="min-h-[48px] md:min-h-[40px] whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 mr-1"/> Thêm size
              </Button>
              )}
            </div>

            <div className="space-y-4">
              {variants.map((variant, vIdx) => {
                const variantRowId = `${formId}-variant-${vIdx}`;
                return (
                  <div key={vIdx} className="bg-surface-card p-4 border border-border rounded-xl flex flex-col sm:flex-row gap-4 sm:items-start">
                    <div className="flex-1">
                      <Field label="Tên size" htmlFor={`${variantRowId}-size-name`} required>
                        <TextInput
                          id={`${variantRowId}-size-name`}
                          required
                          value={variant.size_name}
                          onChange={e => updateVariant(vIdx, "size_name", e.target.value)}
                          example="Size M"
                        />
                      </Field>
                    </div>
                    <div className="flex-1">
                      <Field label="Giá bán" htmlFor={`${variantRowId}-price`}>
                        <NumberInput
                          id={`${variantRowId}-price`}
                          decimals={0}
                          unit="đ"
                          min={0}
                          required
                          example="25,000"
                          disabled={priceReadOnly}
                          hint={priceReadOnly ? "Giá này đặt ở màn hình Topping & Tuỳ chọn." : undefined}
                          error={priceErrors[vIdx]}
                          value={
                            variant.price === "" || variant.price === null || variant.price === undefined
                              ? null
                              : Number(variant.price)
                          }
                          onValueChange={v => updateVariant(vIdx, "price", v === null ? "" : v)}
                        />
                      </Field>
                    </div>
                    {variants.length > 1 && (
                      <Button
                        variant="delete"
                        type="button"
                        className="self-end sm:self-auto sm:mt-6"
                        onClick={(e) => {
                          e.currentTarget.dispatchEvent(new Event("change", { bubbles: true }));
                          removeVariant(vIdx);
                        }}
                      >
                        Xoá size
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* NHÓM TUỲ CHỌN */}
        {optionGroups && optionGroups.length > 0 && (
          <div className="bg-transparent md:bg-page p-0 md:p-5 rounded-none md:rounded-xl border-0 md:border border-border">
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
              Nhóm tuỳ chọn
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Chọn các nhóm tuỳ chọn áp dụng cho món này (đường, đá, topping...).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {optionGroups
                .filter((g) => g.status !== "INACTIVE")
                .map((group) => {
                  const checked = selectedOptionGroupIds.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary min-h-[48px] md:min-h-[40px] p-2.5 rounded-xl border border-border bg-surface-card hover:bg-surface-secondary/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={group.id}
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOptionGroupIds((prev) => [...prev, group.id]);
                          } else {
                            setSelectedOptionGroupIds((prev) => prev.filter((id) => id !== group.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                      />
                      <span>{group.name}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        )}

        {saveError && (
          <Alert variant="danger">
            {saveError}
          </Alert>
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
