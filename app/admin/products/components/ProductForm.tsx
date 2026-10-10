"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/admin/products/actions";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { Plus } from "lucide-react";
import { alert, confirm } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";

interface ProductFormProps {
  categories: Array<{ id: string; name: string }>;
  initialData?: any;
  returnTo?: string;
  canDelete?: boolean;
}

export default function ProductForm({ categories, initialData, returnTo: rawReturnTo }: ProductFormProps) {
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

  // variants format: { id?: string, size_name: string, price: number | string }
  const [variants, setVariants] = useState<any[]>(
    initialData?.variants || [{ size_name: "Mặc định", price: "" }]
  );
  const [priceErrors, setPriceErrors] = useState<Record<number, string>>({});
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(
    initialData?.effective_date ? new Date(initialData.effective_date) : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !categoryId) {
      return await alert({ title: "Thiếu thông tin", message: "Vui lòng nhập Tên món và chọn Nhóm.", variant: "warning" });
    }
    if (variants.length === 0) {
      return await alert({ title: "Thiếu thông tin", message: "Phải có ít nhất 1 size.", variant: "warning" });
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

    const effectiveDateStr = effectiveDate ? effectiveDate.toISOString() : "";
    formData.append("effective_date", effectiveDateStr);

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
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
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
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-4xl shadow-sm">
      <form id={isEdit ? `editProd-${initialData.id}` : "addProd"} onSubmit={handleSubmit} className="space-y-6">
        {/* THÔNG TIN CHUNG */}
        <div className="bg-page p-5 rounded-xl border border-border">
          <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
            Thông tin cơ bản
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tên món" htmlFor={`${formId}-name`} required>
              <TextInput
                id={`${formId}-name`}
                required
                value={name}
                onChange={e => setName(e.target.value)}
                example="Cà phê sữa đá"
              />
            </Field>
            <Field label="Nhóm món" htmlFor={`${formId}-category-id`} required>
              <Select
                id={`${formId}-category-id`}
                required
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">-- Chọn nhóm --</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Field
              label="Ngày áp dụng giá (Tuỳ chọn)"
              htmlFor={`${formId}-effective-date`}
              hint="Bỏ trống hệ thống sẽ lấy thời gian hiện tại. Dành cho việc cập nhật lịch sử bán hàng cũ."
            >
              <div className="w-full md:w-1/2">
                <CustomDatePicker
                  id={`${formId}-effective-date`}
                  name="effective_date"
                  selected={effectiveDate}
                  onChange={(date) => setEffectiveDate(date)}
                  placeholderText="dd/mm/yyyy hh:mm:ss"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* VARIANTS */}
        <div className="bg-page p-5 rounded-xl border border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
              Các size
            </h3>
            <Button variant="secondary" type="button" onClick={addVariant} className="min-h-[44px] md:min-h-[40px]">
              <Plus className="w-4 h-4 mr-1"/> Thêm Size
            </Button>
          </div>

          <div className="space-y-4">
            {variants.map((variant, vIdx) => {
              const variantRowId = `${formId}-variant-${vIdx}`;
              return (
                <div key={vIdx} className="bg-surface-card p-4 border border-border rounded-xl flex flex-col sm:flex-row gap-4 sm:items-end">
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
                      className="self-end sm:self-auto"
                      onClick={() => removeVariant(vIdx)}
                    >
                      Xoá Size
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
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
            variant="primary"
            type="submit"
            loading={loading}
            className="w-full sm:w-auto min-h-[44px] md:min-h-[40px]"
          >
            Lưu món
          </Button>
        </div>
      </form>
    </div>
  );
}
