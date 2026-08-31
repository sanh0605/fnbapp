"use client";

import { useState, useId } from "react";
import { addPurchasedItem, updatePurchasedItem } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { confirm } from "@/lib/dialog";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBUnit } from "@/types/db";

// Batch 1, item B: the part of handleSubmit that decides what goes into
// units_json/base_unit/base_ingredient_id, pulled out as a pure function.
// react-dom 18.3.1 (what this repo's package.json declares, and what
// vitest resolves) treats a function-valued <form action> as an ordinary
// (sanitised-to-string) DOM attribute -- Next.js's own build pipeline
// aliases react-dom to a different, forms-action-aware build at runtime,
// which is why this works in the real app but no combination of
// dispatched submit event, requestSubmit(), or a real button .click()
// reaches handleSubmit under plain vitest+jsdom. Extracted so the actual
// decision logic -- the thing OPEN-ITEMS 38/section B4 care about -- is
// directly testable without depending on that gap. handleSubmit calls this
// unchanged; behaviour is identical to before the extraction.
export type ConversionSubmissionFields = {
  base_unit: string;
  units_json: string;
};

export function buildConversionSubmission(params: {
  isRaw: boolean;
  isConsumable: boolean;
  isEquipment: boolean;
  baseUnitId: string | undefined;
  unitsState: Array<{ id?: string; name: string; conversion_rate: string }>;
  units: Array<{ id: string; name: string }>;
}): { ok: true; fields: ConversionSubmissionFields } | { ok: false; error: string } | { ok: true; fields: null } {
  const { isRaw, isConsumable, isEquipment, baseUnitId, unitsState, units } = params;

  // 2026-08-26 (docs/superpowers/plans/2026-08-26-equipment-needs-units.md):
  // EQUIPMENT now gets the same base-unit/conversion section as CONSUMABLE --
  // a purchase line should record what the invoice says (e.g. "1 Combo 10"),
  // not force the owner to do pack-size arithmetic in his head. This branch
  // is unreachable in practice once a category is chosen (all three system
  // types are covered above), and stays as the "nothing selected yet" case.
  if (!(isRaw || isConsumable || isEquipment)) return { ok: true, fields: null };

  // 2026-08-20 fix: close the hole, not just the instance that caused it --
  // baseUnitId must already be resolved to a real unit id by the caller. A
  // name (or anything else units[] does not recognise) fails visibly here
  // instead of writing a corrupt uom_conversions.base_unit row, mirroring
  // the per-row unit validation just below.
  if (!baseUnitId || !units.some(unit => unit.id === baseUnitId)) {
    return { ok: false, error: "Đơn vị gốc không hợp lệ" };
  }

  const processedUnits = unitsState.map(u => ({ ...u }));
  for (let i = 0; i < processedUnits.length; i++) {
    const u = processedUnits[i];
    if (!u.name || !u.conversion_rate) {
      return { ok: false, error: `Vui lòng nhập đủ thông tin Quy đổi (dòng ${i + 1})` };
    }
    const unitObj = units.find(unit => unit.name.toLowerCase() === u.name.toLowerCase());
    if (!unitObj) {
      return { ok: false, error: `Đơn vị "${u.name}" không hợp lệ (dòng ${i + 1})` };
    }
    processedUnits[i] = { ...u, name: unitObj.id };
  }

  const fields: ConversionSubmissionFields = {
    base_unit: baseUnitId || "",
    units_json: JSON.stringify(processedUnits),
  };
  return { ok: true, fields };
}

// docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md section 5.1:
// the base unit belongs to the item, not to its tier-2 group. Before this,
// a RAW item's baseUnitId was derived inline as
// `activeBaseIngredient?.base_unit` -- always the group's unit, with no way
// to choose a different one even when the item is bought in a different
// unit than its group's label suggests (the Trái tắc / Trái chanh case).
// Extracted to a pure function for the same reason buildConversionSubmission
// was: this decision needs to be directly testable, and a RAW item choosing
// its own unit is exactly the behaviour change this plan makes.
export function resolveBaseUnitId(params: {
  isRaw: boolean;
  isConsumable: boolean;
  isEquipment: boolean;
  selectedBaseUnitName: string;
  units: Array<{ id: string; name: string }>;
}): string | undefined {
  if (!(params.isRaw || params.isConsumable || params.isEquipment)) return undefined;
  return params.units.find(u => u.name === params.selectedBaseUnitName)?.id;
}

interface PurchasedItemFormProps {
  itemCategories: DBItemCategory[];
  units: DBUnit[];
  initialData?: DBPurchasedItem;
  initialConversions?: DBUOMConversion[];
  // section 4: true once this item has any purchase_order_lines or
  // stock_issues row -- every recorded quantity is expressed in its
  // current base unit, so the selector below renders read-only instead of
  // editable. Absent (undefined) for a brand-new item, which is always free.
  isUnitLocked?: boolean;
}

export function PurchasedItemForm({
  itemCategories,
  units,
  initialData,
  initialConversions,
  isUnitLocked = false,
}: PurchasedItemFormProps) {
  const formId = useId();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.item_category_id || "");

  const activeCategory = itemCategories.find(c => c.id === selectedCategoryId);
  const isRaw = activeCategory?.system_type === "RAW";
  // Batch 1, item B (section B2): a consumable has no ingredient to derive
  // a base unit from, so it needs its own selector -- equipment gets
  // neither this nor the conversion rows below (section B3).
  const isConsumable = activeCategory?.system_type === "CONSUMABLE";
  const isEquipment = activeCategory?.system_type === "EQUIPMENT";

  const [unitsState, setUnitsState] = useState<Array<{ id?: string; name: string; conversion_rate: string }>>(
    initialConversions && initialConversions.length > 0
      ? initialConversions.map(c => {
          const pUnit = c.purchased_unit || "";
          // purchased_unit được lưu trong DB là unit ID (VD: "U001")
          // nhưng SearchableSelect dùng unit name làm value → cần convert
          const unitName = units.find(u => u.id === pUnit)?.name || pUnit;
          return { id: c.id, name: unitName, conversion_rate: c.conversion_rate || "" };
        })
      : [{ name: "", conversion_rate: "" }]
  );

  const [updateHistory, setUpdateHistory] = useState(true);

  // 2026-08-21 (docs/superpowers/plans/2026-08-21-non-inventory-purchased-items.md):
  // the discriminator is BR-INV-007 -- does a sealed pack of it sit on the
  // shelf to be counted -- not the category itself, so this is offered for
  // CONSUMABLE and EQUIPMENT alike, never RAW (a RAW item inherits the
  // decision from its ingredient's own is_non_inventory).
  const [isNonInventory, setIsNonInventory] = useState(initialData?.is_non_inventory ?? false);

  // An item's base unit has no field of its own to read from -- on edit,
  // seed it from whatever its existing conversions already agree on (every
  // conversion of one item shares one base_unit; verified 2026-08-29 across
  // all 146 real items, 0 disagree). unitOptions below is keyed by unit
  // *name* (SearchableSelect has no separate id/label split for this
  // field), so the state this selector drives must hold a name, not the id
  // stored on the row -- the same id-to-name conversion `purchased_unit`
  // already goes through just above, for the same reason.
  // 2026-08-20 fix: this field used to hold the id directly, which matched
  // nothing in a name-keyed select (created rows: name saved as base_unit
  // instead of id; edited rows: selector rendered empty).
  //
  // Renamed 2026-08-29 (docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md
  // section 5.1) from selectedConsumableBaseUnitName -- the old name was
  // the bug's fingerprint, since RAW now uses this same state instead of
  // deriving its unit from the linked ingredient's group.
  const [selectedBaseUnitName, setSelectedBaseUnitName] = useState(
    initialConversions && initialConversions.length > 0
      ? units.find(u => u.id === initialConversions[0].base_unit)?.name || initialConversions[0].base_unit || ""
      : "",
  );

  // The unit belongs to the item, not to a tier-2 group (same plan, section
  // 5.1): RAW, CONSUMABLE, and EQUIPMENT all resolve the same way now. Tier-2
  // groups themselves are gone as of 2026-09-01
  // (docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md) --
  // a RAW item no longer links to one at all.
  const baseUnitId = resolveBaseUnitId({ isRaw, isConsumable, isEquipment, selectedBaseUnitName, units });
  const baseUnitName = baseUnitId ? units.find(u => u.id === baseUnitId)?.name : "";
  const showConversionSection = (isRaw || isConsumable || isEquipment) && !!selectedBaseUnitName;

  function addUnitRow() {
    setUnitsState([...unitsState, { name: "", conversion_rate: "" }]);
  }

  function updateUnitRow(index: number, field: "name" | "conversion_rate", value: string) {
    const newUnits = [...unitsState];
    newUnits[index][field] = value;
    setUnitsState(newUnits);
  }

  function removeUnitRow(index: number) {
    if (unitsState.length <= 1) return;
    setUnitsState(unitsState.filter((_, i) => i !== index));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const name = formData.get("name") as string;
    if (!name || !selectedCategoryId) {
      setError("Vui lòng nhập Tên và chọn Phân loại");
      setLoading(false);
      return;
    }

    // The tier-2 group link requirement was removed 2026-09-01
    // (docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md)
    // along with the base_ingredients table itself.
    // 2026-08-29: RAW needs its own base unit -- it no longer inherits one
    // from a group.
    if ((isRaw || isConsumable || isEquipment) && !selectedBaseUnitName) {
      setError("Vui lòng chọn Đơn vị gốc");
      setLoading(false);
      return;
    }

    // Gate 2 of 4 (section B1): building and sending units_json at all.
    // isRaw || isConsumable || isEquipment is the same gate the JSX below
    // uses to decide whether to show the base-unit/conversion inputs.
    const submission = buildConversionSubmission({
      isRaw,
      isConsumable,
      isEquipment,
      baseUnitId,
      unitsState,
      units,
    });
    if (!submission.ok) {
      setError(submission.error);
      setLoading(false);
      return;
    }
    if (submission.fields) {
      formData.append("base_unit", submission.fields.base_unit);
      formData.append("units_json", submission.fields.units_json);
    }

    formData.append("item_category_id", selectedCategoryId);
    // 2026-08-26 (docs/superpowers/plans/2026-08-26-equipment-out-of-stocktake.md):
    // equipment's stocktake exclusion is now category-based, so this flag no
    // longer controls that for equipment -- only its other meaning remains
    // (the future batch-5 expense line), which equipment must never opt
    // into (it is always depreciated, never expensed on purchase). Forced
    // here, not just hidden below, so stale local state from a prior
    // category selection can never leak through.
    formData.append("is_non_inventory", String(isEquipment ? false : isNonInventory));

    const submitFn = isEdit ? updatePurchasedItem : addPurchasedItem;
    if (isEdit) {
      formData.append("id", initialData!.id);
      formData.append("update_history", String(updateHistory));
    }
    let res = await submitFn(formData);
    // Batch 1 follow-up, level 2 (BR-CATALOG-001): a near-match warning,
    // not a refusal -- ask, resubmit once on "món khác", stay on the form
    // with nothing saved on "tôi gõ nhầm".
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
        res = await submitFn(formData);
      } else {
        setLoading(false);
        return;
      }
    }
    if (res.error) setError(res.error);
    else if (isEdit) {
      setIsOpen(false);
    } else {
      setIsOpen(false);
      setSelectedCategoryId("");
      setUnitsState([{ name: "", conversion_rate: "" }]);
      setIsNonInventory(false);
    }
    setLoading(false);
  }

  const categoryOptions = itemCategories.map(c => ({ id: c.id, label: c.name }));
  const unitOptions = units.map(u => ({ id: u.name, label: u.name }));

  return (
    <>
      {isEdit ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setIsOpen(true)}
          className="mr-2"
        >
          Sửa
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
        >
          + Thêm Hàng Mua Vào
        </Button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Hàng Hóa Mua Vào" : "Thêm Hàng Hóa Mua Vào"}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Hủy
            </Button>
            <LoadingButton
              type="submit"
              form="purchased-item-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu"}
            </LoadingButton>
          </>
        }
      >
        <form id="purchased-item-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">Tên Hàng Hóa</label>
              <input
                id={`${formId}-name`}
                type="text"
                name="name"
                required
                defaultValue={initialData?.name}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
                placeholder="VD: Cà phê hạt Robusta 500g"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-categoryId`} className="block text-sm font-medium text-text-secondary mb-1">Phân Loại</label>
              <select
                id={`${formId}-categoryId`}
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
                required
              >
                <option value="">Chọn phân loại...</option>
                {itemCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isRaw && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="p-3 bg-primary-soft text-primary-active text-sm rounded-lg border border-primary/20">
                Đây là nhóm <strong>Hàng Hóa Chế Biến (RAW)</strong>.
              </div>

              {/* docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md
                  section 5.1: the base unit belongs to the item, not to
                  this group -- it no longer comes from the ingredient
                  above, it is chosen here, the same way CONSUMABLE and
                  EQUIPMENT already choose theirs. */}
              <BaseUnitSelector
                formId={formId}
                unitOptions={unitOptions}
                selectedBaseUnitName={selectedBaseUnitName}
                setSelectedBaseUnitName={setSelectedBaseUnitName}
                isUnitLocked={isUnitLocked}
              />

              {showConversionSection && (
                <ConversionRowsSection
                  formId={formId}
                  unitsState={unitsState}
                  unitOptions={unitOptions}
                  baseUnitName={baseUnitName}
                  addUnitRow={addUnitRow}
                  updateUnitRow={updateUnitRow}
                  removeUnitRow={removeUnitRow}
                  isEdit={isEdit}
                  updateHistory={updateHistory}
                  setUpdateHistory={setUpdateHistory}
                />
              )}
            </div>
          )}

          {/* Batch 1, item B (section B2), extended 2026-08-26 to EQUIPMENT
              (docs/superpowers/plans/2026-08-26-equipment-needs-units.md):
              neither category has an ingredient to derive a base unit from,
              so both get this selector. RAW gets its own block above. */}
          {(isConsumable || isEquipment) && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="p-3 bg-primary-soft text-primary-active text-sm rounded-lg border border-primary/20">
                {isEquipment ? (
                  <>Đây là nhóm <strong>Dụng Cụ</strong>. Chọn đơn vị gốc để hệ thống ghi đúng số lượng khi mua theo lốc/thùng (VD: 1 Combo 10 Chai = 10 cái).</>
                ) : (
                  <>Đây là nhóm <strong>Vật Tư Tiêu Hao</strong>. Chọn đơn vị gốc để hệ thống biết cách quy đổi và đếm tồn kho.</>
                )}
              </div>

              <BaseUnitSelector
                formId={formId}
                unitOptions={unitOptions}
                selectedBaseUnitName={selectedBaseUnitName}
                setSelectedBaseUnitName={setSelectedBaseUnitName}
                isUnitLocked={isUnitLocked}
              />

              {showConversionSection && (
                <ConversionRowsSection
                  formId={formId}
                  unitsState={unitsState}
                  unitOptions={unitOptions}
                  baseUnitName={baseUnitName}
                  addUnitRow={addUnitRow}
                  updateUnitRow={updateUnitRow}
                  removeUnitRow={removeUnitRow}
                  isEdit={isEdit}
                  updateHistory={updateHistory}
                  setUpdateHistory={setUpdateHistory}
                />
              )}
            </div>
          )}

          {/* 2026-08-21: originally CONSUMABLE only -- RAW inherited the
              decision from its ingredient's own is_non_inventory
              (BR-COGS-007) instead of setting it here. Narrowed from
              CONSUMABLE-or-EQUIPMENT to CONSUMABLE-only on 2026-08-26
              (docs/superpowers/plans/2026-08-26-equipment-out-of-stocktake.md):
              once equipment is excluded from stocktake by category, this
              flag no longer affects equipment's stocktake eligibility at
              all, and leaving it settable would let the owner re-open the
              exact double-count this flag's other meaning (the future
              batch-5 expense line, OPEN-ITEMS 59) exists to prevent --
              equipment must always be depreciated, never expensed on
              purchase. handleSubmit forces is_non_inventory to false for
              equipment regardless, but hiding the control here is what
              keeps that forcing from ever being a surprise. That reasoning
              is unchanged for EQUIPMENT.

              Reopened for RAW on 2026-08-31
              (docs/superpowers/plans/2026-08-31-move-non-inventory-flag-to-items.md):
              the owner decided 2026-08-29 to remove the tier-2 ingredient
              groups, so a RAW item will soon have no group left to inherit
              this decision from. The stocktake/issue-slip exclusion checks
              are additive (item flag OR group flag), so both sources can
              coexist safely until the groups are actually removed -- this
              does not yet retire the group-level flag, only adds the
              item-level one RAW was missing. */}
          {(isConsumable || isRaw) && (
            <label
              htmlFor={`${formId}-isNonInventory`}
              className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg border border-border cursor-pointer min-h-[44px]"
            >
              <input
                type="checkbox"
                id={`${formId}-isNonInventory`}
                checked={isNonInventory}
                onChange={(e) => setIsNonInventory(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0 rounded border-border text-primary focus:ring-focus-ring"
              />
              <span className="text-sm text-text-secondary leading-tight">
                <span className="font-medium text-text-primary">Không quản lý tồn kho</span> (ví dụ: muỗng nhựa, túi rác) —
                mua đâu dùng đó, không đóng gói để đếm được, nên sẽ không xuất hiện trong danh sách kiểm kê.
              </span>
            </label>
          )}
        </form>
      </FormModal>
    </>
  );
}

// docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md section 4/5.1:
// one implementation shared by RAW, CONSUMABLE and EQUIPMENT, so the locked
// (read-only) rendering can never drift between them the way two separate
// copies could. When isUnitLocked, this is display-only text, not an input
// -- there is no client-side path that can submit a different value, and
// the server-side check (lib/unit-lock.ts, called from
// app/admin/inventory/items/actions.ts) is what actually enforces it.
function BaseUnitSelector({
  formId,
  unitOptions,
  selectedBaseUnitName,
  setSelectedBaseUnitName,
  isUnitLocked,
}: {
  formId: string;
  unitOptions: Array<{ id: string; label: string }>;
  selectedBaseUnitName: string;
  setSelectedBaseUnitName: (value: string) => void;
  isUnitLocked: boolean;
}) {
  return (
    <div>
      <label htmlFor={`${formId}-baseUnitId`} className="block text-sm font-medium text-text-secondary mb-1">Đơn vị gốc</label>
      {isUnitLocked ? (
        <>
          <div
            id={`${formId}-baseUnitId`}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-secondary text-text-secondary"
          >
            {selectedBaseUnitName || "—"}
          </div>
          <p className="text-xs text-text-muted mt-1">
            Không thể đổi đơn vị gốc vì mặt hàng này đã có phiếu nhập hàng hoặc phiếu xuất kho ghi số lượng theo đơn vị này.
          </p>
        </>
      ) : (
        <SearchableSelect
          id={`${formId}-baseUnitId`}
          options={unitOptions}
          value={selectedBaseUnitName}
          onChange={setSelectedBaseUnitName}
          placeholder="Chọn đơn vị gốc..."
        />
      )}
    </div>
  );
}

// Batch 1, item B: the conversion-rows block, unchanged in behaviour from
// what previously rendered only inside the RAW branch -- extracted so RAW
// and CONSUMABLE (section B2) share one implementation instead of two
// copies that could silently drift apart.
function ConversionRowsSection({
  formId,
  unitsState,
  unitOptions,
  baseUnitName,
  addUnitRow,
  updateUnitRow,
  removeUnitRow,
  isEdit,
  updateHistory,
  setUpdateHistory,
}: {
  formId: string;
  unitsState: Array<{ id?: string; name: string; conversion_rate: string }>;
  unitOptions: Array<{ id: string; label: string }>;
  baseUnitName: string | undefined;
  addUnitRow: () => void;
  updateUnitRow: (index: number, field: "name" | "conversion_rate", value: string) => void;
  removeUnitRow: (index: number) => void;
  isEdit: boolean;
  updateHistory: boolean;
  setUpdateHistory: (value: boolean) => void;
}) {
  return (
    <div className="bg-page p-4 rounded-xl border border-border">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-text-primary">Quy đổi đơn vị mua</h4>
        <button
          type="button"
          onClick={addUnitRow}
          className="text-xs font-bold text-primary hover:text-primary-hover"
        >
          + Thêm đơn vị mua
        </button>
      </div>

      <div className="space-y-3">
        {unitsState.map((u, idx) => {
          const unitRowId = `${formId}-unit-${idx}`;
          return (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <label htmlFor={`${unitRowId}-name`} className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Đơn vị mua</label>
                <SearchableSelect
                  id={`${unitRowId}-name`}
                  options={unitOptions}
                  value={u.name}
                  onChange={(val) => updateUnitRow(idx, "name", val)}
                  placeholder="VD: Bao 10kg"
                />
              </div>
              <div className="px-2 pb-2 text-text-muted font-bold">=</div>
              <div className="w-24 relative">
                <label htmlFor={`${unitRowId}-conversion_rate`} className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Hệ số</label>
                <input
                  id={`${unitRowId}-conversion_rate`}
                  type="number"
                  step="any"
                  value={u.conversion_rate}
                  onChange={(e) => updateUnitRow(idx, "conversion_rate", e.target.value)}
                  className="w-full border border-border rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
                />
              </div>
              <div className="px-2 pb-2 text-sm text-text-secondary font-medium">
                {baseUnitName || "cơ bản"}
              </div>
              {unitsState.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUnitRow(idx)}
                  className="pb-2 px-2 text-text-muted hover:text-danger"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isEdit && (
        <div className="mt-4 flex items-start gap-2 p-2 bg-warning/10 rounded-lg border border-warning/20">
          <input
            type="checkbox"
            id={`${formId}-update_history`}
            checked={updateHistory}
            onChange={(e) => setUpdateHistory(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-border text-warning focus:ring-warning"
          />
          <label htmlFor={`${formId}-update_history`} className="text-xs text-warning-active leading-tight">
            Cập nhật lại đơn vị mua cho các đơn đặt hàng cũ của mặt hàng này nếu đơn vị mua bị thay đổi.
          </label>
        </div>
      )}
    </div>
  );
}
