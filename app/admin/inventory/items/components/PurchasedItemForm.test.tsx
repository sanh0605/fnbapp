// @vitest-environment jsdom
//
// Render tests for Batch 1, item B (conversions for consumables):
// docs/superpowers/plans/2026-08-19-batch-1-foundations.md section B.
//
// Section B4's own instruction: "choose Vat tu tieu hao, fill a conversion,
// submit against a mocked action, and assert units_json is present in the
// payload with the typed values." Verified directly against react-dom
// 18.3.1 (this repo's own package.json version, what vitest resolves): a
// function-valued <form action> is treated as an ordinary DOM attribute --
// no combination of a real submit-button .click(), requestSubmit(), or a
// dispatched submit/SubmitEvent (with or without a forced isTrusted, with
// or without an explicit submitter) reaches handleSubmit under plain
// vitest+jsdom. Next.js's own build pipeline aliases react-dom to a
// forms-action-aware build at runtime, which is why the real app works;
// vitest does not go through that aliasing. This is a structural gap in
// the test harness, not something fixable by trying a different event.
//
// Split accordingly, per OPEN-ITEMS 38 (render, not source grep) on both
// halves: these tests render the real component and read the real,
// rendered DOM to prove the UI correctly renders per category and captures
// typed values into state, and PurchasedItemForm.submission.test.ts calls
// the real, exported buildConversionSubmission directly (extracted from
// handleSubmit, identical logic, zero behaviour change) to prove that
// state is correctly turned into units_json/base_unit -- the exact
// assertion section B4 names, decoupled from the untestable submission
// mechanism rather than skipped.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { PurchasedItemForm } from "./PurchasedItemForm";

const mocks = vi.hoisted(() => ({
  addPurchasedItem: vi.fn(),
  updatePurchasedItem: vi.fn(),
}));

vi.mock("../actions", () => ({
  addPurchasedItem: mocks.addPurchasedItem,
  updatePurchasedItem: mocks.updatePurchasedItem,
}));

// SearchableSelect scrolls the highlighted option into view when the
// dropdown opens; jsdom does not implement scrollIntoView at all.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (roots.length) {
    const root = roots.pop()!;
    act(() => {
      root.unmount();
    });
  }
  while (containers.length) {
    containers.pop()!.remove();
  }
});

async function renderTracked(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  roots.push(root);
  containers.push(container);
  return container;
}

async function fireClick(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

// FormModal renders through ModalPortal, which mounts its children only
// after its own effect fires -- one extra tick beyond the triggering click.
async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function setSelectValue(select: HTMLSelectElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")!.set!;
  await act(async () => {
    nativeSetter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// SearchableSelect renders its dropdown as a sibling inside its own
// wrapper, not a portal -- scoping the query to `wrapper` picks the right
// instance even with several SearchableSelect components mounted at once.
async function chooseInCombobox(wrapper: HTMLElement, optionLabel: string) {
  const trigger = wrapper.querySelector('[role="combobox"]');
  if (!trigger) throw new Error("combobox trigger not found in wrapper");
  await fireClick(trigger);
  const option = Array.from(wrapper.querySelectorAll('[role="option"]')).find(
    el => el.textContent?.trim() === optionLabel,
  );
  if (!option) throw new Error(`option not found: "${optionLabel}"`);
  await fireClick(option);
}

function findButtonWithText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
}

const CATEGORIES = [
  { id: "NHH-001", name: "Nguyên liệu", system_type: "RAW" },
  { id: "NHH-002", name: "Vật tư tiêu hao", system_type: "CONSUMABLE" },
  { id: "NHH-003", name: "Dụng cụ", system_type: "EQUIPMENT" },
];
const UNITS = [
  { id: "U-BAO", name: "Bao" },
  { id: "U-G", name: "g" },
];
const BASE_INGREDIENTS = [{ id: "ING-032", name: "Sữa chua không đường", base_unit: "U-G", status: "ACTIVE" }];

async function openForm() {
  const container = await renderTracked(
    <PurchasedItemForm
      itemCategories={CATEGORIES as any}
      baseIngredients={BASE_INGREDIENTS as any}
      units={UNITS as any}
    />,
  );
  const openBtn = findButtonWithText(container, "+ Thêm Hàng Mua Vào")!;
  await fireClick(openBtn);
  await flush();
  return container;
}

// 2026-08-20 fix: edit mode seeds its base-unit selector from
// initialConversions -- the only way to reach the id-in-a-name-keyed-select
// half of the defect (section 1, path #2).
async function openEditForm(initialData: any, initialConversions: any[]) {
  const container = await renderTracked(
    <PurchasedItemForm
      itemCategories={CATEGORIES as any}
      baseIngredients={BASE_INGREDIENTS as any}
      units={UNITS as any}
      initialData={initialData}
      initialConversions={initialConversions}
    />,
  );
  const openBtn = findButtonWithText(container, "Sửa")!;
  await fireClick(openBtn);
  await flush();
  return container;
}

describe("PurchasedItemForm -- conversions for consumables, rendered UI (Batch 1, item B)", () => {
  // 2026-08-26 (docs/superpowers/plans/2026-08-26-equipment-needs-units.md):
  // replaces the old "EQUIPMENT gets neither section" test -- a purchase
  // line should record what the invoice says (e.g. "1 Combo 10"), the same
  // as CONSUMABLE, not force the owner into pack-size arithmetic.
  it("choosing Dụng cụ shows the base-unit selector, and choosing a unit reveals the conversion rows", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-003");

    expect(document.body.textContent).toContain("Đơn vị gốc");
    expect(document.body.textContent).not.toContain("Quy đổi đơn vị mua");

    const baseUnitWrapper = document.querySelector('[role="combobox"]')!.closest(".relative") as HTMLElement;
    await chooseInCombobox(baseUnitWrapper, "g");

    expect(document.body.textContent).toContain("Quy đổi đơn vị mua");
  });

  it("choosing Vật tư tiêu hao shows the base-unit selector, and choosing a unit reveals the conversion rows", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-002");

    expect(document.body.textContent).toContain("Đơn vị gốc");
    // No unit chosen yet -- the conversion-rows section is not shown
    // (section B2: nothing to derive a package size against yet).
    expect(document.body.textContent).not.toContain("Quy đổi đơn vị mua");

    const baseUnitWrapper = document.querySelector('[role="combobox"]')!.closest(".relative") as HTMLElement;
    await chooseInCombobox(baseUnitWrapper, "g");

    expect(document.body.textContent).toContain("Quy đổi đơn vị mua");
  });

  it("captures the typed conversion row (purchase unit + rate) in the rendered inputs", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-002");

    const baseUnitWrapper = document.querySelector('[role="combobox"]')!.closest(".relative") as HTMLElement;
    await chooseInCombobox(baseUnitWrapper, "g");

    const purchasedUnitWrapper = Array.from(document.querySelectorAll('[role="combobox"]'))
      .map(el => el.closest(".relative") as HTMLElement)
      .find(w => w !== baseUnitWrapper)!;
    await chooseInCombobox(purchasedUnitWrapper, "Bao");

    const rateInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await setInputValue(rateInput, "500");

    // "Bao" chosen in the SearchableSelect renders as its own trigger text,
    // and the base-unit label ("g", from section B2's selector) appears
    // next to the rate input -- both are what a user standing at this
    // screen actually sees, not internal state.
    expect(purchasedUnitWrapper.textContent).toContain("Bao");
    expect(rateInput.value).toBe("500");
    expect(document.body.textContent).toContain("g");
  });

  // 2026-08-29 (docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md
  // section 5.1): this assertion is now the opposite of what it was --
  // before this task, "Đơn vị gốc" never appeared for RAW because the unit
  // was silently derived from the linked group; confirmed to fail on the
  // VALUE against the pre-fix code (not a missing field or function), which
  // is the whole point this task exists to change.
  it("RAW keeps its group-link requirement, and now also gets its own base-unit selector -- the unit no longer comes from the group", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-001");

    expect(document.body.textContent).toContain("Hàng Hóa Chế Biến (RAW)");
    expect(document.body.textContent).toContain("Liên kết Nhóm Nguyên Liệu");
    expect(document.body.textContent).toContain("Đơn vị gốc");
    // Conversion rows require a unit chosen first (same as CONSUMABLE/EQUIPMENT) --
    // picking a group alone must not reveal them.
    expect(document.body.textContent).not.toContain("Quy đổi đơn vị mua");
  });

  it("a RAW item's base unit is chosen independently of its group -- kg for an item linked to a group whose own label is a different unit", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-001");

    const baseIngredientWrapper = document.querySelector('[role="combobox"]')!.closest(".relative") as HTMLElement;
    await chooseInCombobox(baseIngredientWrapper, "Sữa chua không đường");

    // BASE_INGREDIENTS' own base_unit is "g" (U-G) -- choosing "Bao" here as
    // the item's base unit must not be overridden by the group's unit.
    const baseUnitWrapper = Array.from(document.querySelectorAll('[role="combobox"]'))
      .map(el => el.closest(".relative") as HTMLElement)
      .find(w => w !== baseIngredientWrapper)!;
    await chooseInCombobox(baseUnitWrapper, "Bao");

    expect(baseUnitWrapper.textContent).toContain("Bao");
    // Conversion rows now appear, keyed to the chosen base unit ("Bao"),
    // not the group's ("g").
    expect(document.body.textContent).toContain("Quy đổi đơn vị mua");
  });

  it("editing a RAW item with purchase/issue history shows its base unit read-only, with an explanation, and does not offer the selector", async () => {
    const initialData = {
      id: "SPM-100",
      name: "Trái tắc",
      item_category_id: "NHH-001",
      base_ingredient_id: "ING-032",
    };
    const initialConversions = [
      { id: "QD-100", purchased_item_id: "SPM-100", purchased_unit: "U-BAO", base_unit: "U-G", conversion_rate: "1000" },
    ];
    const container = await renderTracked(
      <PurchasedItemForm
        itemCategories={CATEGORIES as any}
        baseIngredients={BASE_INGREDIENTS as any}
        units={UNITS as any}
        initialData={initialData as any}
        initialConversions={initialConversions as any}
        isUnitLocked={true}
      />,
    );
    const openBtn = findButtonWithText(container, "Sửa")!;
    await fireClick(openBtn);
    await flush();

    // No interactive selector for the base unit -- its placeholder (only
    // ever rendered by the editable SearchableSelect variant) must not
    // appear at all, even though other comboboxes on the form (the
    // group-link selector, the purchase-unit picker inside the conversion
    // row) are unaffected by this lock and stay interactive.
    expect(document.body.textContent).not.toContain("Chọn đơn vị gốc...");
    expect(document.body.textContent).toContain("Không thể đổi đơn vị gốc");
  });
});

// 2026-08-20 fix: docs/superpowers/plans/2026-08-20-consumable-base-unit-mismatch.md.
// unitOptions is keyed by unit *name*; the consumable base-unit state used to
// hold the id SearchableSelect never emits for this field, so it matched
// nothing. These assert the rendered text a user actually sees, not the
// internal state, and both were confirmed to fail against the pre-fix code
// before this task started.
describe("PurchasedItemForm -- consumable base unit renders correctly, not as an id-in-a-name-keyed-select mismatch (2026-08-20 fix)", () => {
  it("choosing base unit 'g' shows 'g' beside the conversion rate, not the 'cơ bản' fallback", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-002");

    const baseUnitWrapper = document.querySelector('[role="combobox"]')!.closest(".relative") as HTMLElement;
    await chooseInCombobox(baseUnitWrapper, "g");

    // Scoped to the specific label beside the rate input, not a whole-page
    // text search -- the base-unit selector's own trigger already displays
    // "g" regardless of this defect (its options are keyed by name, so the
    // chosen value always matches something), so a document.body.textContent
    // check would pass whether or not the bug this task fixes exists.
    const rateInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    const row = rateInput.closest(".flex.gap-2.items-end") as HTMLElement;
    const baseUnitLabel = row.querySelector(".text-sm.text-text-secondary.font-medium") as HTMLElement;

    expect(baseUnitLabel.textContent?.trim()).toBe("g");
  });

  it("edit mode seeds the base-unit selector from the stored unit id, showing its name (not empty)", async () => {
    const initialData = {
      id: "SPM-053",
      name: "Ống hút nhỏ",
      item_category_id: "NHH-002",
      base_ingredient_id: "",
    };
    const initialConversions = [
      { id: "QD-001", purchased_item_id: "SPM-053", purchased_unit: "U-BAO", base_unit: "U-G", conversion_rate: "500" },
    ];
    await openEditForm(initialData, initialConversions);

    const baseUnitTrigger = document.querySelector('[role="combobox"]') as HTMLElement;

    expect(baseUnitTrigger.textContent?.trim()).toBe("g");
  });
});

// 2026-08-21: docs/superpowers/plans/2026-08-21-non-inventory-purchased-items.md
// section 3.2 / 5. Render assertion only (OPEN-ITEMS 46's limit) -- no
// submission needed to check whether the checkbox appears.
//
// Narrowed to CONSUMABLE-only on 2026-08-26
// (docs/superpowers/plans/2026-08-26-equipment-out-of-stocktake.md): once
// equipment is excluded from stocktake by category, this flag no longer
// controls that for equipment, and leaving it settable would reopen the
// double-count OPEN-ITEMS 59 warns about (equipment must always be
// depreciated, never expensed on purchase).
describe("PurchasedItemForm -- 'Không quản lý tồn kho' checkbox (2026-08-21, narrowed 2026-08-26)", () => {
  it("appears for Vật tư tiêu hao (CONSUMABLE)", async () => {
    await openForm();
    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-002");

    expect(document.body.textContent).toContain("Không quản lý tồn kho");
  });

  it("does not appear for Dụng cụ (EQUIPMENT) -- category-based stocktake exclusion makes it inert, and settable would risk double-counting against depreciation", async () => {
    await openForm();
    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-003");

    expect(document.body.textContent).not.toContain("Không quản lý tồn kho");
  });

  it("does not appear for Nguyên liệu (RAW) -- inherits the decision from its ingredient instead", async () => {
    await openForm();
    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-001");

    expect(document.body.textContent).not.toContain("Không quản lý tồn kho");
  });
});
