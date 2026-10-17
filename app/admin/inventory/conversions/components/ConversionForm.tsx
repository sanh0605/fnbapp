"use client";

import { useState, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import { addConversion, updateConversion } from "../actions";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { NumberInput } from "@/components/ui/NumberInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { safeReturnTo } from "@/lib/shared/return-to";
import { formatDecimal } from "@/lib/shared/format";
import type { DBPurchasedItem, DBUnit, DBUOMConversion } from "@/types/db";

interface ConversionFormProps {
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
  initialData?: DBUOMConversion;
  returnTo?: string;
}

export function ConversionForm({
  items,
  conversions,
  units,
  initialData,
  returnTo: rawReturnTo,
}: ConversionFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/conversions");
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState(initialData?.purchased_item_id || "");
  const [selectedUnitName, setSelectedUnitName] = useState(
    initialData ? units.find(u => u.id === initialData.purchased_unit)?.name || "" : ""
  );
  const [conversionRate, setConversionRate] = useState(initialData?.conversion_rate || "");
  // Plan D D15: a purchase-only bundle (e.g. "Combo 2") -- keeps showing up
  // when receiving a purchase order, hidden from stocktake/issue-slip lines.
  const [purchaseOnly, setPurchaseOnly] = useState(initialData?.purchase_only === true);

  const itemOptions = items.map(item => ({ id: item.id, label: item.name }));
  const unitOptions = units
    .filter(u =>
      u.status === "ACTIVE" ||
      u.id === initialData?.purchased_unit ||
      u.id === initialData?.base_unit ||
      (selectedUnitName && u.name.toLowerCase() === selectedUnitName.toLowerCase())
    )
    .map(u => ({ id: u.name, label: u.name }));

  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedItemId), 
    [items, selectedItemId]
  );

  // section
  // 5.2: the base unit belongs to the item, not to its tier-2 group -- take
  // it from the item's own existing conversions (they all agree, verified
  // 2026-08-29 across all 146 real items, 0 disagree), the same way this
  // screen already trusted that agreement implicitly. This is also what
  // lets a CONSUMABLE/EQUIPMENT item (no base_ingredient_id at all) get a
  // conversion here -- previously refused outright since baseIngredient
  // was always null for them.
  const itemConversions = useMemo(() =>
    selectedItem ? conversions.filter(c => c.purchased_item_id === selectedItem.id) : [],
    [conversions, selectedItem]
  );

  const baseUnit = useMemo(() =>
    itemConversions.length > 0 ? units.find(u => u.id === itemConversions[0].base_unit) : null,
    [units, itemConversions]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    if (!selectedItemId || !selectedUnitName || !conversionRate || !baseUnit) {
      setError("Vui lòng điền đầy đủ thông tin");
      setLoading(false);
      return;
    }

    const unitObj = units.find(u => u.name.toLowerCase() === selectedUnitName.toLowerCase());
    if (!unitObj) {
      setError("Đơn vị mua không hợp lệ");
      setLoading(false);
      return;
    }

    formData.append("purchased_item_id", selectedItemId);
    formData.append("purchased_unit", unitObj.id);
    formData.append("conversion_rate", conversionRate);
    formData.append("base_unit", baseUnit.id);
    formData.append("purchase_only", String(purchaseOnly));

    // section B: revalidatePath (in addConversion/updateConversion) marks
    // the server cache stale but does not repaint this already-open page.
    if (isEdit) {
      formData.append("id", initialData!.id);
      const res = await updateConversion(formData);
      setLoading(false);
      if (res.error) setError(res.error);
      else {
        router.push(returnTo);
        router.refresh();
      }
    } else {
      const res = await addConversion(formData);
      setLoading(false);
      if (res.error) setError(res.error);
      else {
        router.push(returnTo);
        router.refresh();
      }
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger">{error}</Alert>
        )}

        <Field label="Hàng hoá" htmlFor={`${formId}-selectedItemId`}>
          <SearchableSelect
            id={`${formId}-selectedItemId`}
            options={itemOptions}
            value={selectedItemId}
            onChange={setSelectedItemId}
            placeholder="Chọn hàng hoá..."
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Đơn vị mua" htmlFor={`${formId}-selectedUnitName`}>
            <SearchableSelect
              id={`${formId}-selectedUnitName`}
              options={unitOptions}
              value={selectedUnitName}
              onChange={setSelectedUnitName}
              placeholder="Ví dụ: Thùng 24 lon"
            />
          </Field>
          <Field label="Hệ số quy đổi" htmlFor={`${formId}-conversionRate`}>
            <NumberInput
              id={`${formId}-conversionRate`}
              decimals={6}
              min={0}
              minExclusive
              example="1,000"
              required
              value={conversionRate === "" ? null : Number(conversionRate)}
              onValueChange={(v) => setConversionRate(v === null ? "" : String(v))}
            />
          </Field>
        </div>

        {baseUnit && (
          <div className="p-3 bg-primary-soft rounded-lg border border-primary/20">
            <div className="text-xs font-bold text-primary-active uppercase tracking-wider mb-1">
              Quy đổi sang đơn vị cơ bản
            </div>
            <div className="text-sm font-medium text-primary-active">
              1 {selectedUnitName || "..."} = <span className="font-bold text-primary">{formatDecimal(Number(conversionRate || 0), { maxDigits: 6 })}</span> {baseUnit.name}
            </div>
            <div className="text-[13px] text-primary mt-1 italic">
              (Đơn vị gốc đã thiết lập cho {selectedItem?.name})
            </div>
          </div>
        )}

        <label
          htmlFor={`${formId}-purchase_only`}
          className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg border border-border cursor-pointer min-h-[48px] md:min-h-[40px]"
        >
          <input
            type="checkbox"
            id={`${formId}-purchase_only`}
            checked={purchaseOnly}
            onChange={(e) => setPurchaseOnly(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 rounded border-border text-primary focus:ring-focus-ring"
          />
          <span className="text-sm text-text-secondary leading-tight">
            <span className="font-medium text-text-primary">Chỉ là cách mua</span> (ví dụ: combo, thùng khuyến mãi) —
            vẫn hiện khi nhập hàng, nhưng ẩn khỏi kiểm kê và phiếu xuất kho vì đây không phải thứ cầm lên đếm được.
          </span>
        </label>

        <FormActionBar
          mode={isEdit ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
