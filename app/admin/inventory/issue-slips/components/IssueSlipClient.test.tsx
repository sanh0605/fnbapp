// @vitest-environment jsdom
//
// Render tests for IssueSlipClient (OPEN-ITEMS 38). IssueSlipClient.test.ts
// asserted 20 claims against source text with almost no render coverage --
// the two-copies shape this item exists to close. Classified before writing
// anything: 18 of 20 convert to a real render assertion here; 1 (the
// two-column `lg:grid-cols-2` layout) is genuinely inexpressible in jsdom
// (breakpoint-conditional, no media-query evaluation) and stays in the
// slimmed IssueSlipClient.test.ts; 1 ("uses SearchableSelect") is deleted
// outright as redundant -- every test below that selects an item necessarily
// drives the real SearchableSelect combobox to do it.
//
// This also carries the OPEN-ITEMS 41 unit-label render tests added
// 2026-08-17 -- one render file per component, not several.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { IssueSlipClient } from "./IssueSlipClient";
import type { IssueSlipItemView, IssueSlipRow } from "../actions";
import type { PackageLine } from "@/lib/stocktake-package-lines";
import type { IssueSlipResult } from "@/lib/manual-issue-transaction";

const mocks = vi.hoisted(() => ({
  createIssueSlip: vi.fn(),
  reverseIssueSlip: vi.fn(),
  cancelIssueSlip: vi.fn(),
  confirmDialog: vi.fn(),
}));

vi.mock("../actions", () => ({
  createIssueSlip: mocks.createIssueSlip,
  reverseIssueSlip: mocks.reverseIssueSlip,
  cancelIssueSlip: mocks.cancelIssueSlip,
}));

// IssueSlipClient's own confirm() (a custom Promise-based dialog rendered by
// DialogHost, which is not mounted here) would otherwise hang forever --
// nothing calls dismiss(). Auto-approves by default; individual tests that
// need to prove the declined path override this per-test.
vi.mock("@/lib/dialog", () => ({
  confirm: mocks.confirmDialog,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmDialog.mockResolvedValue(true);
});

// SearchableSelect scrolls the highlighted option into view when the
// dropdown opens; jsdom does not implement scrollIntoView at all.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
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

async function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function selectItem(container: HTMLElement, label: string) {
  const combobox = container.querySelector('[role="combobox"]');
  if (!combobox) throw new Error("SearchableSelect trigger not found");
  await fireClick(combobox);
  const option = Array.from(container.querySelectorAll('[role="option"]')).find(
    el => el.textContent?.trim() === label,
  );
  if (!option) throw new Error(`option not found: "${label}"`);
  await fireClick(option);
}

function clickButtonWithText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === text);
  if (!btn) throw new Error(`button not found: "${text}"`);
  return fireClick(btn);
}

function findButtonWithText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
}

// Each draft line's own wrapper div carries this exact class combination
// (IssueSlipClient.tsx: `className="p-4 border border-border rounded-xl
// relative bg-surface-secondary/50"`) and nothing else in the tree does.
function getLineBlocks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("div.rounded-xl.relative"));
}

// SearchableSelect renders its dropdown as a sibling inside its own wrapper,
// not a portal -- scoping the query to `block` is safe even with several
// SearchableSelect instances (one per line) in the same render.
async function selectItemInBlock(block: HTMLElement, label: string) {
  const combobox = block.querySelector('[role="combobox"]');
  if (!combobox) throw new Error("SearchableSelect trigger not found in block");
  await fireClick(combobox);
  const option = Array.from(block.querySelectorAll('[role="option"]')).find(el => el.textContent?.trim() === label);
  if (!option) throw new Error(`option not found: "${label}"`);
  await fireClick(option);
}

async function selectPackage(block: HTMLElement, sizeLabel: string) {
  const select = block.querySelector("select") as HTMLSelectElement | null;
  if (!select) throw new Error("Quy cách select not found in block");
  const option = Array.from(select.options).find(o => o.textContent?.trim() === sizeLabel);
  if (!option) throw new Error(`package option not found: "${sizeLabel}"`);
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")!.set!;
  await act(async () => {
    nativeSetter.call(select, option.value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function findQtyInput(block: HTMLElement): HTMLInputElement {
  const input = block.querySelector('input[type="number"]');
  if (!input) throw new Error("quantity input not found");
  return input as HTMLInputElement;
}

// --- Fixtures ------------------------------------------------------------

function pkg(overrides: Partial<PackageLine> = {}): PackageLine {
  return {
    conversionId: "QD-001",
    purchasedItemId: "SPM-001",
    purchasedItemName: "Sữa tươi Vinamilk",
    sizeLabel: "Thùng 12 hộp",
    conversionRate: 12,
    baseUnitName: "hộp",
    ...overrides,
  };
}

function item(overrides: Partial<IssueSlipItemView> = {}): IssueSlipItemView {
  return {
    id: "SPM-001",
    name: "Sữa tươi Vinamilk",
    onHand: 12,
    unitName: "hộp",
    packageLines: [pkg()],
    ...overrides,
  };
}

function row(overrides: Partial<IssueSlipRow> = {}): IssueSlipRow {
  return {
    id: "ISS-001",
    slipId: "ISL-001",
    itemName: "Sữa tươi Vinamilk",
    baseQuantity: 24,
    issuedAt: "2026-08-17T09:00:00.000Z",
    note: "Hao hụt",
    reversesIssueId: null,
    reversedByIssueId: null,
    ...overrides,
  };
}

function submittedResult(overrides: Partial<IssueSlipResult> = {}): IssueSlipResult {
  return {
    slipId: "ISL-999",
    issuedAt: "2026-08-17T09:00:00.000Z",
    note: "Hao hụt",
    createdById: "admin-1",
    createdByName: "Admin",
    lines: [],
    ...overrides,
  };
}

// --- OPEN-ITEMS 41: on-hand unit label -------------------------------------

const itemWithRealUnit: IssueSlipItemView = {
  id: "SPM-001",
  name: "Sua tuoi Vinamilk",
  onHand: 12,
  unitName: "kg",
  packageLines: [
    { conversionId: "QD-001", purchasedItemId: "SPM-001", purchasedItemName: "Sua tuoi Vinamilk", sizeLabel: "Thung 12 hop", conversionRate: 12, baseUnitName: "kg" },
  ],
};

// The real SPM-043 case, post-correction (2026-08-17): QD-049's base_unit
// now agrees with its ingredient's own "g", so getIssueSlipFormData's
// generic lookup resolves it like any other item -- no special case.
const itemFormerlyMismatched: IssueSlipItemView = {
  id: "SPM-043",
  name: "Sua chua khong duong Vinamilk",
  onHand: 48,
  unitName: "g",
  packageLines: [
    { conversionId: "QD-049", purchasedItemId: "SPM-043", purchasedItemName: "Sua chua khong duong Vinamilk", sizeLabel: "Hop 100 g", conversionRate: 100, baseUnitName: "g" },
  ],
};

describe("IssueSlipClient onHand unit label (OPEN-ITEMS 41)", () => {
  it("renders the real unit next to the on-hand quantity", async () => {
    const container = await renderTracked(
      <IssueSlipClient items={[itemWithRealUnit]} recentSlips={[]} />,
    );
    await selectItem(container, "Sua tuoi Vinamilk");

    const line = Array.from(container.querySelectorAll("p")).find(p =>
      p.textContent?.includes("Tồn hiện tại"),
    );
    expect(line?.textContent?.trim()).toBe("Tồn hiện tại: 12 kg");
  });

  it("renders g for Sua chua khong duong Vinamilk now that QD-049 is corrected", async () => {
    const container = await renderTracked(
      <IssueSlipClient items={[itemFormerlyMismatched]} recentSlips={[]} />,
    );
    await selectItem(container, "Sua chua khong duong Vinamilk");

    const line = Array.from(container.querySelectorAll("p")).find(p =>
      p.textContent?.includes("Tồn hiện tại"),
    );
    expect(line?.textContent?.trim()).toBe("Tồn hiện tại: 48 g");
  });
});

// --- I3: package-size counting produces the base quantity sent to the RPC --

describe("IssueSlipClient -- package-size counting produces the base quantity sent to the RPC (I3)", () => {
  it("multiplies the typed package count by the chosen conversion rate before submitting", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const theItem = item({
      packageLines: [
        pkg({ conversionId: "QD-001", sizeLabel: "Thùng 12 hộp", conversionRate: 12 }),
        pkg({ conversionId: "QD-002", sizeLabel: "Hộp lẻ", conversionRate: 1 }),
      ],
    });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} recentSlips={[]} />);
    const block = getLineBlocks(container)[0];

    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "3");
    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(mocks.createIssueSlip).toHaveBeenCalledTimes(1);
    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.lines).toEqual([{ purchasedItemId: "SPM-001", baseQuantity: 36 }]);
  });
});

// --- I6: backdated slip warns which months move, requires explicit confirm -

describe("IssueSlipClient -- backdated slip warns which months move and requires explicit confirm (I6)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("confirm() names the affected months; declining it blocks the RPC call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    mocks.confirmDialog.mockResolvedValue(false);
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "2");
    const datetimeInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await setInputValue(datetimeInput, "2026-06-01T09:00");

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(mocks.confirmDialog).toHaveBeenCalledTimes(1);
    const message = mocks.confirmDialog.mock.calls[0][0].message;
    expect(message).toContain("Tháng 6/2026");
    expect(message).toContain("Tháng 8/2026");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });

  it("approving the confirm proceeds to call the RPC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "2");
    const datetimeInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await setInputValue(datetimeInput, "2026-06-01T09:00");

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(mocks.createIssueSlip).toHaveBeenCalledTimes(1);
  });
});

// --- I4/I5/I10: does not pre-empt the RPC's own refusal, for this input ----

describe("IssueSlipClient -- does not pre-empt the RPC's on-hand refusal, for this input (I4/I5/I10)", () => {
  it("submits an over-onHand quantity unchanged and shows the RPC's refusal verbatim when it rejects", async () => {
    // Proves the client does not block THIS specific input locally -- it
    // does not prove no local check of any shape exists for a different
    // input or threshold. The RPC's own refusal is what actually decides;
    // this shows the client gets out of the way and surfaces the answer.
    mocks.createIssueSlip.mockResolvedValue({
      error: "Dòng 1 (Sữa tươi Vinamilk): yêu cầu xuất 999 hộp, chỉ còn 12 hộp tính tới thời điểm hiện tại",
    });
    const theItem = item({ onHand: 12 });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} recentSlips={[]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "999");
    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.lines[0].baseQuantity).toBe(999 * 12);
    expect(container.textContent).toContain("chỉ còn 12 hộp tính tới thời điểm hiện tại");
  });
});

// --- datetime defaults near now; the submitted value is a real instant -----

describe("IssueSlipClient -- time field defaults near now and submits a real instant, not a bare date", () => {
  it("the datetime-local input starts within a minute of now", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    const datetimeInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const initial = new Date(datetimeInput.value).getTime();
    expect(Math.abs(Date.now() - initial)).toBeLessThan(60_000);
  });

  it("the value sent to the RPC carries the typed time, not midnight", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "2");
    const datetimeInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const raw = "2026-08-17T14:30";
    await setInputValue(datetimeInput, raw);

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.issuedAtIso).toBe(new Date(raw).toISOString());
  });
});

// --- D9: add/remove line list ------------------------------------------

describe("IssueSlipClient -- manages an add/remove line list (D9)", () => {
  it("adding and removing lines changes the number of rendered line blocks", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    expect(getLineBlocks(container)).toHaveLength(1);

    await clickButtonWithText(container, "+ Thêm mặt hàng");
    expect(getLineBlocks(container)).toHaveLength(2);

    const removeBtn = getLineBlocks(container)[0].querySelector('button[aria-label="Xoá dòng"]');
    await fireClick(removeBtn!);
    expect(getLineBlocks(container)).toHaveLength(1);
  });
});

// --- D9: one RPC call for the whole slip, not one per item ------------------

describe("IssueSlipClient -- sends every line in ONE RPC call, not one per item (D9)", () => {
  it("a 3-line slip produces exactly one createIssueSlip call with all 3 lines", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const items3 = [
      item({
        id: "SPM-001",
        name: "Sữa tươi Vinamilk",
        packageLines: [pkg({ conversionId: "QD-001", purchasedItemId: "SPM-001", sizeLabel: "Thùng 12 hộp", conversionRate: 12 })],
      }),
      item({
        id: "SPM-002",
        name: "Đường cát",
        packageLines: [pkg({ conversionId: "QD-002", purchasedItemId: "SPM-002", sizeLabel: "Bao 25kg", conversionRate: 25 })],
      }),
      item({
        id: "SPM-003",
        name: "Cà phê hạt",
        packageLines: [pkg({ conversionId: "QD-003", purchasedItemId: "SPM-003", sizeLabel: "Túi 1kg", conversionRate: 1 })],
      }),
    ];
    const container = await renderTracked(<IssueSlipClient items={items3} recentSlips={[]} />);

    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");

    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await selectItemInBlock(getLineBlocks(container)[1], "Đường cát");
    await selectPackage(getLineBlocks(container)[1], "Bao 25kg");
    await setInputValue(findQtyInput(getLineBlocks(container)[1]), "3");

    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await selectItemInBlock(getLineBlocks(container)[2], "Cà phê hạt");
    await selectPackage(getLineBlocks(container)[2], "Túi 1kg");
    await setInputValue(findQtyInput(getLineBlocks(container)[2]), "5");

    await clickButtonWithText(container, "Ghi phiếu xuất (3 dòng)");

    expect(mocks.createIssueSlip).toHaveBeenCalledTimes(1);
    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.lines).toEqual([
      { purchasedItemId: "SPM-001", baseQuantity: 24 },
      { purchasedItemId: "SPM-002", baseQuantity: 75 },
      { purchasedItemId: "SPM-003", baseQuantity: 5 },
    ]);
  });
});

// --- D9: one time field and one reason across the whole slip ---------------

describe("IssueSlipClient -- shares one time field and one reason across the whole slip (D9)", () => {
  it("stays at exactly one datetime-local input and one reason select as lines are added", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await clickButtonWithText(container, "+ Thêm mặt hàng");

    expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(1);
    expect(container.textContent).toContain("áp dụng cho cả phiếu");
    // The "Lý do" select is the only <select> outside the per-line blocks --
    // each line block has its own "Quy cách" select.
    const allSelects = Array.from(container.querySelectorAll("select"));
    const lineBlockSelects = getLineBlocks(container).flatMap(b => Array.from(b.querySelectorAll("select")));
    expect(allSelects.length - lineBlockSelects.length).toBe(1);
  });
});

// --- D9: per-line validation names which line is wrong ----------------------

describe("IssueSlipClient -- per-line validation names which line is wrong, before ever calling the RPC (D9)", () => {
  it("names line 2 when its item is unselected, and does not call the RPC", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");
    // Line 2 left with no item chosen.

    await clickButtonWithText(container, "Ghi phiếu xuất (2 dòng)");

    expect(container.textContent).toContain("Dòng 2: chưa chọn mặt hàng");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });

  it("names line 1 when its package size is unselected, and does not call the RPC", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    // Choosing an item auto-fills its first package size (handleItemChange)
    // -- explicitly reset back to the placeholder to reach the unselected
    // state a user gets to by reopening "Quy cách" and clearing it.
    await selectPackage(getLineBlocks(container)[0], "-- Chọn --");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(container.textContent).toContain("Dòng 1: chưa chọn quy cách");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });

  it("names line 1 when its quantity is zero, and does not call the RPC", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");
    // Quantity left blank.

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(container.textContent).toContain("Dòng 1: số lượng phải lớn hơn 0");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });
});

// --- D7b/D9, BR-INV-009 reversal UI -----------------------------------------

describe("IssueSlipClient -- only offers to reverse an eligible row (D7b/D9)", () => {
  it("shows Đảo dòng only for a MANUAL row that is not itself a reversal and has not already been reversed", async () => {
    const eligible = row({ id: "ISS-001", slipId: "ISL-001", itemName: "Sữa tươi Vinamilk" });
    const isAReversal = row({ id: "ISS-002", slipId: "ISL-002", itemName: "Đường cát", reversesIssueId: "ISS-000" });
    const alreadyReversed = row({ id: "ISS-003", slipId: "ISL-003", itemName: "Cà phê hạt", reversedByIssueId: "ISS-004" });
    const container = await renderTracked(
      <IssueSlipClient items={[]} recentSlips={[eligible, isAReversal, alreadyReversed]} />,
    );

    const reverseButtons = Array.from(container.querySelectorAll("button")).filter(
      b => b.textContent?.trim() === "Đảo dòng",
    );
    expect(reverseButtons).toHaveLength(1);
    const rowEl = reverseButtons[0].closest(".border-l-2") as HTMLElement;
    expect(rowEl?.textContent).toContain("Sữa tươi Vinamilk");
  });
});

describe("IssueSlipClient -- reversal requires an explicit confirm naming BR-INV-009 (D7b/D9)", () => {
  it("opens confirm() with a message naming BR-INV-009 and that the original line is preserved, before calling the RPC", async () => {
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.reverseIssueSlip.mockResolvedValue({});
    const eligible = row({ id: "ISS-001", slipId: "ISL-001" });
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[eligible]} />);

    await clickButtonWithText(container, "Đảo dòng");

    expect(mocks.confirmDialog).toHaveBeenCalledTimes(1);
    const message = mocks.confirmDialog.mock.calls[0][0].message;
    expect(message).toContain("BR-INV-009");
    expect(message).toContain("Dòng gốc được giữ nguyên, không xoá");
    expect(mocks.reverseIssueSlip).toHaveBeenCalledWith(expect.objectContaining({ issueId: "ISS-001" }));
  });

  it("does not call reverseIssueSlip when the confirm is declined", async () => {
    mocks.confirmDialog.mockResolvedValue(false);
    const eligible = row({ id: "ISS-001", slipId: "ISL-001" });
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[eligible]} />);

    await clickButtonWithText(container, "Đảo dòng");

    expect(mocks.reverseIssueSlip).not.toHaveBeenCalled();
  });
});

describe("IssueSlipClient -- a reversed pair shows both ways, neither row hidden (D7b/D9)", () => {
  it("the reversal row names what it reverses; the original names what reversed it", async () => {
    const original = row({ id: "ISS-001", slipId: "ISL-001", itemName: "Sữa tươi Vinamilk", reversedByIssueId: "ISS-002" });
    const reversal = row({
      id: "ISS-002",
      slipId: "ISL-002",
      itemName: "Sữa tươi Vinamilk",
      baseQuantity: -24,
      reversesIssueId: "ISS-001",
    });
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[original, reversal]} />);

    expect(container.textContent).toContain("Đảo dòng ISS-001");
    expect(container.textContent).toContain("Đã đảo bởi ISS-002");
  });
});

describe("IssueSlipClient -- groups rows by slipId, falling back to the row's own id (D9)", () => {
  it("two rows sharing a slipId render as one group; a null-slipId row shows the legacy fallback", async () => {
    const lineA = row({ id: "ISS-001", slipId: "ISL-001", itemName: "Sữa tươi Vinamilk" });
    const lineB = row({ id: "ISS-002", slipId: "ISL-001", itemName: "Đường cát" });
    const legacy = row({ id: "ISS-003", slipId: null, itemName: "Cà phê hạt" });
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[lineA, lineB, legacy]} />);

    const occurrences = (container.textContent?.split("ISL-001").length ?? 1) - 1;
    expect(occurrences).toBe(1);
    expect(container.textContent).toContain("Sữa tươi Vinamilk");
    expect(container.textContent).toContain("Đường cát");
    expect(container.textContent).toContain("(phiếu cũ)");
  });
});

describe("IssueSlipClient -- reversal stays per-line, not one button per slip (D9)", () => {
  it("a 2-line slip with both rows eligible shows two Đảo dòng buttons, not one", async () => {
    const lineA = row({ id: "ISS-001", slipId: "ISL-001", itemName: "Sữa tươi Vinamilk" });
    const lineB = row({ id: "ISS-002", slipId: "ISL-001", itemName: "Đường cát" });
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[lineA, lineB]} />);

    const reverseButtons = Array.from(container.querySelectorAll("button")).filter(
      b => b.textContent?.trim() === "Đảo dòng",
    );
    expect(reverseButtons).toHaveLength(2);
  });
});

// --- D10: explicit empty state, field sizing, mobile (M2-M4) ---------------

describe("IssueSlipClient -- RecentSlipsSection always renders, with an explicit empty state (D10)", () => {
  it("renders the empty-state message rather than nothing when there are no recent slips", async () => {
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[]} />);
    expect(container.textContent).toContain("Chưa có phiếu xuất nào");
  });
});

describe("IssueSlipClient -- Số lượng field sizing and Chi tiết input shape (D10)", () => {
  it("the Số lượng field carries the compact w-24 width class (class presence, not measured width)", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    const qtyInput = findQtyInput(getLineBlocks(container)[0]);
    expect(qtyInput.closest(".w-24")).toBeTruthy();
  });

  it("Chi tiết is a single-line text input, not a multi-row textarea", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    expect(container.querySelector("textarea")).toBeNull();
    const detailInput = container.querySelector(
      'input[placeholder="Ví dụ: rơi vỡ khi vận chuyển..."]',
    ) as HTMLInputElement | null;
    expect(detailInput).toBeTruthy();
    expect(detailInput?.type).toBe("text");
  });
});

describe("IssueSlipClient -- M2, the quantity input opens a numeric phone keypad", () => {
  it("the Số lượng input's inputMode is numeric", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    expect(findQtyInput(getLineBlocks(container)[0]).getAttribute("inputmode")).toBe("numeric");
  });
});

describe("IssueSlipClient -- M3, tap targets carry the 44px-tier class, not the 32px one (class presence, not measured size)", () => {
  it("the add-line button carries min-h-[44px]", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    const addBtn = findButtonWithText(container, "+ Thêm mặt hàng");
    expect(addBtn?.className).toContain("min-h-[44px]");
  });

  it("the remove-line button carries the p-2 padding class that gives it a real hit area", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    const removeBtn = getLineBlocks(container)[0].querySelector('button[aria-label="Xoá dòng"]');
    expect(removeBtn?.className).toContain("p-2");
  });

  it("the Đảo dòng reverse button carries min-h-[44px], not the 32px sm size", async () => {
    const eligible = row({ id: "ISS-001", slipId: "ISL-001" });
    const container = await renderTracked(<IssueSlipClient items={[]} recentSlips={[eligible]} />);
    const reverseBtn = findButtonWithText(container, "Đảo dòng");
    expect(reverseBtn?.className).toContain("min-h-[44px]");
    expect(reverseBtn?.className).not.toContain("min-h-[32px]");
  });
});

describe("IssueSlipClient -- M4, the live ready-to-submit count matches handleSubmit's own validation (D10)", () => {
  it("counts only fully-filled lines as ready", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} recentSlips={[]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");

    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");
    // Line 2 left empty.

    expect(container.textContent).toContain("Đã điền đủ: 1/2 dòng");
  });
});
