// @vitest-environment jsdom
//
// Render tests for Batch 1, item B (conversions for consumables):
// section B.
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
  routerRefresh: vi.fn(),
  push: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("../actions", () => ({
  addPurchasedItem: mocks.addPurchasedItem,
  updatePurchasedItem: mocks.updatePurchasedItem,
}));
// section B: this component now calls useRouter().refresh() on save.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.push }),
}));
vi.mock("@/lib/shared/dialog", () => ({
  confirm: mocks.confirm,
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
  document.body.innerHTML = "";
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
  const option = Array.from(document.body.querySelectorAll('[role="option"]')).find(
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

async function openForm() {
  const container = await renderTracked(
    <PurchasedItemForm
      itemCategories={CATEGORIES as any}
      units={UNITS as any}
    />,
  );
  return container;
}

// 2026-08-20 fix: edit mode seeds its base-unit selector from
// initialConversions -- the only way to reach the id-in-a-name-keyed-select
// half of the defect (section 1, path #2).
async function openEditForm(initialData: any, initialConversions: any[], returnTo?: string) {
  const container = await renderTracked(
    <PurchasedItemForm
      itemCategories={CATEGORIES as any}
      units={UNITS as any}
      initialData={initialData}
      initialConversions={initialConversions}
      returnTo={returnTo}
    />,
  );
  return container;
}

async function submitForm(container: HTMLElement) {
  const form = container.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  for (let i = 0; i < 5; i++) {
    await flush();
  }
}

describe("PurchasedItemForm -- conversions for consumables, rendered UI (Batch 1, item B)", () => {
  // 2026-08-26:
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

  // section 2.2: the group-link field and its requirement are gone along
  // with base_ingredients itself -- confirmed to fail on the VALUE against
  // the pre-fix code (the text was present, not missing), which is the
  // point this task exists to change.
  it("RAW no longer offers a group link, but still gets its own base-unit selector", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-001");

    // BR-UI-001 (owner 2026-10-06): Vietnamese only, no "(RAW)" twin.
    expect(document.body.textContent).toContain("Hàng Hóa Chế Biến");
    expect(document.body.textContent).not.toContain("(RAW)");
    expect(document.body.textContent).not.toContain("Liên kết Nhóm Nguyên Liệu");
    expect(document.body.textContent).toContain("Đơn vị gốc");
    // Conversion rows require a unit chosen first (same as CONSUMABLE/EQUIPMENT).
    expect(document.body.textContent).not.toContain("Quy đổi đơn vị mua");
  });

  it("a RAW item's base unit works the same as CONSUMABLE/EQUIPMENT -- chosen directly, no group involved", async () => {
    await openForm();

    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-001");

    const baseUnitWrapper = document.querySelector('[role="combobox"]')!.closest(".relative") as HTMLElement;
    await chooseInCombobox(baseUnitWrapper, "Bao");

    expect(baseUnitWrapper.textContent).toContain("Bao");
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
        units={UNITS as any}
        initialData={initialData as any}
        initialConversions={initialConversions as any}
        isUnitLocked={true}
      />,
    );

    // No interactive selector for the base unit -- its placeholder (only
    // ever rendered by the editable SearchableSelect variant) must not
    // appear at all, even though the purchase-unit picker inside the
    // conversion row is unaffected by this lock and stays interactive.
    expect(document.body.textContent).not.toContain("Chọn đơn vị gốc...");
    expect(document.body.textContent).toContain("Không thể đổi đơn vị gốc");
  });
});

// 2026-08-20 fix:.
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

// 2026-08-21: 
// section 3.2 / 5. Render assertion only (OPEN-ITEMS 46's limit) -- no
// submission needed to check whether the checkbox appears.
//
// Narrowed to CONSUMABLE-only on 2026-08-26: once
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

  // section 1.2/2: the tier-2 ingredient groups (base_ingredients) are
  // going away, so RAW can no longer only inherit this decision from its
  // group -- it needs its own checkbox, the same as CONSUMABLE. Confirmed
  // red against the pre-fix code before this task started (the checkbox
  // was absent, not merely differently labelled).
  it("appears for Nguyên liệu (RAW) -- the group it used to inherit from is going away", async () => {
    await openForm();
    const categorySelect = document.querySelector("select") as HTMLSelectElement;
    await setSelectValue(categorySelect, "NHH-001");

    expect(document.body.textContent).toContain("Không quản lý tồn kho");
  });
});

describe("PurchasedItemForm on-page behaviour", () => {
  it("renders on page and Bỏ navigates to returnTo without saving", async () => {
    const container = await renderTracked(
      <PurchasedItemForm
        itemCategories={CATEGORIES as any}
        units={UNITS as any}
        returnTo="/admin/inventory/items?category=CAT-1"
      />,
    );
    const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    const boBtn = findButtonWithText(container, "Bỏ")!;
    expect(boBtn).not.toBeUndefined();
    await fireClick(boBtn);
    expect(mocks.push).toHaveBeenCalledWith("/admin/inventory/items?category=CAT-1");
  });
});

describe("PurchasedItemForm -- asset removal confirmation on category change (Task C)", () => {
  const EDIT_ITEM = {
    id: "SPM-067",
    name: "Hộp đựng topping liền nắp",
    item_category_id: "NHH-002",
    is_non_inventory: false,
  };
  const EDIT_CONVERSIONS = [
    { id: "QD-067", purchased_item_id: "SPM-067", purchased_unit: "U-BAO", base_unit: "U-G", conversion_rate: "200" },
  ];

  // The form appends to one FormData and resubmits that same object, so a
  // flag must be read at call time, not from mock.calls afterwards.
  type Flags = { dup: string | null; asset: string | null };
  function respondOnce(seen: Flags[], value: unknown) {
    mocks.updatePurchasedItem.mockImplementationOnce(async (fd: FormData) => {
      seen.push({
        dup: fd.get("duplicate_warning_confirmed") as string | null,
        asset: fd.get("asset_removal_confirmed") as string | null,
      });
      return value;
    });
  }

  it("server returns needsAssetRemoval, user says yes → action called twice, second FormData has asset_removal_confirmed = 'true', then redirect to returnTo", async () => {
    const seen: Flags[] = [];
    respondOnce(seen, { needsAssetRemoval: { message: "Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80.352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?" } });
    respondOnce(seen, { ok: true });
    mocks.confirm.mockResolvedValueOnce(true);

    const container = await openEditForm(EDIT_ITEM, EDIT_CONVERSIONS, "/admin/inventory/items?category=NHH-002");
    await submitForm(container);

    expect(mocks.updatePurchasedItem).toHaveBeenCalledTimes(2);

    expect(seen.map(f => f.asset)).toEqual([null, "true"]);

    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith({
      title: "Gỡ tài sản khỏi trang Tài sản?",
      message: "Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80.352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?",
      okText: "Gỡ và lưu",
      cancelText: "Không lưu",
      variant: "warning",
    });

    expect(mocks.push).toHaveBeenCalledWith("/admin/inventory/items?category=NHH-002");
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("user says no → action called once, no redirect", async () => {
    mocks.updatePurchasedItem.mockResolvedValueOnce({
      needsAssetRemoval: {
        message: "Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80.352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?",
      },
    });
    mocks.confirm.mockResolvedValueOnce(false);

    const container = await openEditForm(EDIT_ITEM, EDIT_CONVERSIONS, "/admin/inventory/items?category=NHH-002");
    await submitForm(container);

    expect(mocks.updatePurchasedItem).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.routerRefresh).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("duplicate warning then asset removal both yes → third call carries both flags", async () => {
    const seen: Flags[] = [];
    respondOnce(seen, {
      needsDuplicateWarning: {
          conflictId: "SPM-999",
          conflictName: "Hộp topping",
          message: "Tên gần giống một mục đã có: Hộp topping",
      },
    });
    respondOnce(seen, { needsAssetRemoval: { message: "Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80.352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?" } });
    respondOnce(seen, { ok: true });
    mocks.confirm
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const container = await openEditForm(EDIT_ITEM, EDIT_CONVERSIONS, "/admin/inventory/items?category=NHH-002");
    await submitForm(container);

    expect(mocks.updatePurchasedItem).toHaveBeenCalledTimes(3);

    expect(seen).toEqual([
      { dup: null, asset: null },
      { dup: "true", asset: null },
      { dup: "true", asset: "true" },
    ]);

    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.confirm).toHaveBeenNthCalledWith(1, {
      title: "Tên gần giống một mục đã có",
      message: "Tên gần giống một mục đã có: Hộp topping",
      okText: "Món khác",
      cancelText: "Tôi gõ nhầm",
      variant: "warning",
    });
    expect(mocks.confirm).toHaveBeenNthCalledWith(2, {
      title: "Gỡ tài sản khỏi trang Tài sản?",
      message: "Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80.352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?",
      okText: "Gỡ và lưu",
      cancelText: "Không lưu",
      variant: "warning",
    });

    expect(mocks.push).toHaveBeenCalledWith("/admin/inventory/items?category=NHH-002");
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
  });
});


