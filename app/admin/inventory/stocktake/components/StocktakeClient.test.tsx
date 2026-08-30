// @vitest-environment jsdom
//
// Render tests for StocktakeClient (OPEN-ITEMS 38). StocktakeClient.test.ts
// asserted against source text only and had no render coverage at all --
// this is the screen the owner uses standing in front of shelves, and a
// source-text assertion passes even when the component throws at render (the
// string is in the file, the screen is not on the page) while also failing
// on a rename that changes nothing a user sees. This file renders the real
// component and reads the DOM, following the createRoot + act pattern from
// components/POSScreen.itemModal.test.tsx and components/ProductForm.test.tsx.
//
// StocktakeClient.test.ts still exists, slimmed to the handful of assertions
// a render test genuinely cannot make (see the comment at its own top).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { StocktakeClient } from "./StocktakeClient";
import type { StocktakeLineView, StocktakeSessionView } from "../actions";
import type { PackageLine } from "@/lib/stocktake-package-lines";
import type { StocktakeApplyResult } from "@/lib/stocktake-transaction";

const mocks = vi.hoisted(() => ({
  startStocktakeSession: vi.fn(),
  saveStocktakeLine: vi.fn(),
  cancelStocktakeSession: vi.fn(),
  getStocktakeConfirmPreview: vi.fn(),
  confirmStocktakeSession: vi.fn(),
  reverseConfirmedStocktakeSession: vi.fn(),
  confirmDialog: vi.fn(),
}));

vi.mock("../actions", () => ({
  startStocktakeSession: mocks.startStocktakeSession,
  saveStocktakeLine: mocks.saveStocktakeLine,
  cancelStocktakeSession: mocks.cancelStocktakeSession,
  getStocktakeConfirmPreview: mocks.getStocktakeConfirmPreview,
  confirmStocktakeSession: mocks.confirmStocktakeSession,
  reverseConfirmedStocktakeSession: mocks.reverseConfirmedStocktakeSession,
}));

// StocktakeClient's own confirm() (a custom Promise-based dialog rendered by
// DialogHost, which is not mounted here) would otherwise hang forever --
// nothing calls dismiss(). Auto-approves, matching what the owner does at
// the shelf when handleApply's own confirm fires.
vi.mock("@/lib/dialog", () => ({
  confirm: mocks.confirmDialog,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmDialog.mockResolvedValue(true);
});

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

// Each purchased-item / legacy card's root carries "rounded-card" in its own
// className, and no ancestor between the item-name span and that root does
// -- closest() lands on exactly the right card even with other unrelated
// rounded-card elements (Alert) elsewhere in the tree.
function findCard(container: HTMLElement, itemName: string): HTMLElement {
  const nameEl = Array.from(container.querySelectorAll("span")).find(s => s.textContent?.trim() === itemName);
  if (!nameEl) throw new Error(`item not found: "${itemName}"`);
  const card = nameEl.closest(".rounded-card");
  if (!card) throw new Error(`card wrapper not found for: "${itemName}"`);
  return card as HTMLElement;
}

function findPackageInput(card: HTMLElement, sizeLabel: string): HTMLInputElement {
  const labelEl = Array.from(card.querySelectorAll("label")).find(
    l => l.querySelector("span")?.textContent?.trim() === sizeLabel,
  );
  const input = labelEl?.querySelector("input");
  if (!input) throw new Error(`package input not found for size: "${sizeLabel}"`);
  return input as HTMLInputElement;
}

function findLegacyInput(card: HTMLElement): HTMLInputElement {
  const input = card.querySelector('input[type="number"]');
  if (!input) throw new Error("legacy input not found");
  return input as HTMLInputElement;
}

// --- Fixtures ------------------------------------------------------------

function pkg(overrides: Partial<PackageLine> = {}): PackageLine {
  return {
    conversionId: "CONV-1",
    purchasedItemId: "SPM-1",
    purchasedItemName: "Item",
    sizeLabel: "Thùng 24 hộp",
    conversionRate: 24,
    baseUnitName: "hộp",
    purchasedUnitName: "Thùng",
    ...overrides,
  };
}

function packageLineItem(overrides: Partial<StocktakeLineView> = {}): StocktakeLineView {
  return {
    id: "LINE-1",
    itemReference: "SPM-1",
    itemType: "PURCHASED_ITEM",
    itemName: "Sữa tươi Vinamilk",
    unitName: "hộp",
    countedQty: null,
    theoreticalAtCount: null,
    countedAt: null,
    packageLines: [pkg()],
    ...overrides,
  };
}

function legacyLineItem(overrides: Partial<StocktakeLineView> = {}): StocktakeLineView {
  return {
    id: "LINE-2",
    itemReference: "ING-1",
    itemType: "BASE_INGREDIENT",
    itemName: "Đường cát",
    unitName: "kg",
    countedQty: null,
    theoreticalAtCount: null,
    countedAt: null,
    packageLines: [],
    ...overrides,
  };
}

function session(lines: StocktakeLineView[]): StocktakeSessionView {
  return {
    id: "STK-001",
    status: "OPEN",
    createdByName: "Admin",
    createdAt: "2026-08-17T09:00:00.000Z",
    notes: "",
    lines,
  };
}

function previewResult(overrides: Partial<StocktakeApplyResult> = {}): StocktakeApplyResult {
  return {
    sessionId: "STK-001",
    status: "OPEN",
    dryRun: true,
    ledgerCount: 1,
    issueCount: 0,
    rows: [],
    skippedIngredients: [],
    planHash: "hash-1",
    ledgerIds: [],
    issueIds: [],
    ...overrides,
  };
}

// --- Tests -----------------------------------------------------------------

describe("StocktakeClient -- package-size counting produces the right base quantity (D6)", () => {
  it("sums every package size on the card into one saveStocktakeLine call", async () => {
    mocks.saveStocktakeLine.mockResolvedValue({});
    const line = packageLineItem({
      packageLines: [
        pkg({ conversionId: "CONV-A1", sizeLabel: "Thùng 24 hộp", conversionRate: 24 }),
        pkg({ conversionId: "CONV-A2", sizeLabel: "Hộp lẻ", conversionRate: 1 }),
      ],
    });
    const container = await renderTracked(<StocktakeClient session={session([line])} lastConfirmed={null} />);
    const card = findCard(container, "Sữa tươi Vinamilk");

    await setInputValue(findPackageInput(card, "Thùng 24 hộp"), "2");
    await setInputValue(findPackageInput(card, "Hộp lẻ"), "3");
    await clickButtonWithText(card, "Xác nhận");

    // 2 x 24 + 3 x 1 = 51 -- proves the rendered inputs' values reach the
    // save call correctly summed, not that the literal expression string
    // exists somewhere in the file.
    expect(mocks.saveStocktakeLine).toHaveBeenCalledTimes(1);
    expect(mocks.saveStocktakeLine).toHaveBeenCalledWith("LINE-1", 51);
  });

  it("shows the confirmed badge after a successful save", async () => {
    mocks.saveStocktakeLine.mockResolvedValue({});
    const line = packageLineItem();
    const container = await renderTracked(<StocktakeClient session={session([line])} lastConfirmed={null} />);
    const card = findCard(container, "Sữa tươi Vinamilk");

    await setInputValue(findPackageInput(card, "Thùng 24 hộp"), "1");
    await clickButtonWithText(card, "Xác nhận");

    expect(card.textContent).toContain("Đã xác nhận");
  });
});

describe("StocktakeClient -- per-line save (must survive a phone locking mid-count)", () => {
  it("fires saveStocktakeLine independently per card, not batched into one submit", async () => {
    mocks.saveStocktakeLine.mockResolvedValue({});
    const packageBased = packageLineItem({ id: "LINE-1", itemName: "Sữa tươi Vinamilk" });
    const legacy = legacyLineItem({ id: "LINE-2", itemName: "Đường cát" });
    const container = await renderTracked(
      <StocktakeClient session={session([packageBased, legacy])} lastConfirmed={null} />,
    );

    const packageCard = findCard(container, "Sữa tươi Vinamilk");
    await setInputValue(findPackageInput(packageCard, "Thùng 24 hộp"), "2");
    await clickButtonWithText(packageCard, "Xác nhận");

    expect(mocks.saveStocktakeLine).toHaveBeenCalledTimes(1);
    expect(mocks.saveStocktakeLine).toHaveBeenNthCalledWith(1, "LINE-1", 48);

    const legacyCard = findCard(container, "Đường cát");
    await setInputValue(findLegacyInput(legacyCard), "10");
    await clickButtonWithText(legacyCard, "Lưu");

    // A second, independent call -- the first line's save already happened
    // and is not re-sent or held back for a batch. There is no submit-all
    // control anywhere on this screen; this is what proves it, not an
    // absence of one in the source.
    expect(mocks.saveStocktakeLine).toHaveBeenCalledTimes(2);
    expect(mocks.saveStocktakeLine).toHaveBeenNthCalledWith(2, "LINE-2", 10);
  });
});

describe("StocktakeClient -- BR-INV-007, whole packages only", () => {
  it("rejects a decimal package count with the BR-INV-007 reason and does not save", async () => {
    const line = packageLineItem({ packageLines: [pkg({ sizeLabel: "Túi 1kg", conversionRate: 1000 })] });
    const container = await renderTracked(<StocktakeClient session={session([line])} lastConfirmed={null} />);
    const card = findCard(container, "Sữa tươi Vinamilk");

    await setInputValue(findPackageInput(card, "Túi 1kg"), "1.5");
    await clickButtonWithText(card, "Xác nhận");

    expect(card.textContent).toContain("BR-INV-007");
    expect(mocks.saveStocktakeLine).not.toHaveBeenCalled();
  });
});

describe("StocktakeClient -- editing after confirmation clears the confirmed state (C6)", () => {
  it("drops the confirmed badge the moment the input changes, without re-saving", async () => {
    const line = packageLineItem({ countedQty: 48, theoreticalAtCount: 40 });
    const container = await renderTracked(<StocktakeClient session={session([line])} lastConfirmed={null} />);
    const card = findCard(container, "Sữa tươi Vinamilk");
    expect(card.textContent).toContain("Đã xác nhận");

    await setInputValue(findPackageInput(card, "Thùng 24 hộp"), "2");

    expect(card.textContent).not.toContain("✓ Đã xác nhận");
    expect(card.textContent).toContain("Đã sửa, chưa xác nhận lại");
    expect(mocks.saveStocktakeLine).not.toHaveBeenCalled();
  });
});

describe("StocktakeClient -- legacy vs package-picker card selection", () => {
  it("a line with package lines gets the picker grid; a line without gets the single legacy input", async () => {
    const withPackages = packageLineItem({ id: "LINE-1", itemName: "Sữa tươi Vinamilk" });
    const withoutPackages = legacyLineItem({ id: "LINE-2", itemName: "Đường cát" });
    const container = await renderTracked(
      <StocktakeClient session={session([withPackages, withoutPackages])} lastConfirmed={null} />,
    );

    const packageCard = findCard(container, "Sữa tươi Vinamilk");
    expect(findButtonWithText(packageCard, "Xác nhận")).toBeTruthy();
    expect(findButtonWithText(packageCard, "Lưu")).toBeFalsy();
    expect(findPackageInput(packageCard, "Thùng 24 hộp").getAttribute("inputmode")).toBe("numeric");

    const legacyCard = findCard(container, "Đường cát");
    expect(findButtonWithText(legacyCard, "Lưu")).toBeTruthy();
    expect(findButtonWithText(legacyCard, "Xác nhận")).toBeFalsy();
    expect(findLegacyInput(legacyCard).getAttribute("inputmode")).toBe("decimal");
  });
});

describe("StocktakeClient -- M3, tap targets are the default 44px size, not the 32px sm size", () => {
  it("the package-card confirm button and the legacy card's save button both use the 44px default", async () => {
    const withPackages = packageLineItem({ id: "LINE-1", itemName: "Sữa tươi Vinamilk" });
    const withoutPackages = legacyLineItem({ id: "LINE-2", itemName: "Đường cát" });
    const container = await renderTracked(
      <StocktakeClient session={session([withPackages, withoutPackages])} lastConfirmed={null} />,
    );

    const confirmBtn = findButtonWithText(findCard(container, "Sữa tươi Vinamilk"), "Xác nhận")!;
    expect(confirmBtn.className).toContain("min-h-[44px]");
    expect(confirmBtn.className).not.toContain("min-h-[32px]");

    const saveBtn = findButtonWithText(findCard(container, "Đường cát"), "Lưu")!;
    expect(saveBtn.className).toContain("min-h-[44px]");
    expect(saveBtn.className).not.toContain("min-h-[32px]");
  });
});

describe("StocktakeClient -- progress count (M4, the non-CSS-positioned half)", () => {
  it("the session banner reports counted/total accurately", async () => {
    const lines = [
      packageLineItem({ id: "LINE-1", itemName: "Sữa tươi Vinamilk", countedQty: 48, theoreticalAtCount: 40 }),
      legacyLineItem({ id: "LINE-2", itemName: "Đường cát" }),
      legacyLineItem({ id: "LINE-3", itemName: "Muối", itemReference: "ING-2" }),
    ];
    const container = await renderTracked(<StocktakeClient session={session(lines)} lastConfirmed={null} />);

    expect(container.textContent).toContain("Đã đếm 1/3 mặt hàng.");
  });
});

describe("StocktakeClient -- preview gates the apply confirmation (D6/D12)", () => {
  it("no preview means no apply-confirm button and enabled edit controls; previewing disables editing; back returns", async () => {
    mocks.getStocktakeConfirmPreview.mockResolvedValue({ preview: previewResult() });
    const line = packageLineItem();
    const container = await renderTracked(<StocktakeClient session={session([line])} lastConfirmed={null} />);

    expect(findButtonWithText(container, "Xác nhận áp dụng")).toBeFalsy();
    expect(findPackageInput(findCard(container, "Sữa tươi Vinamilk"), "Thùng 24 hộp").disabled).toBe(false);

    await clickButtonWithText(container, "Xác nhận và áp dụng");

    expect(findButtonWithText(container, "Xác nhận áp dụng")).toBeTruthy();
    expect(findPackageInput(findCard(container, "Sữa tươi Vinamilk"), "Thùng 24 hộp").disabled).toBe(true);
    expect(findButtonWithText(container, "Xác nhận")!.disabled).toBe(true);

    await clickButtonWithText(container, "Quay lại chỉnh sửa");

    expect(findButtonWithText(container, "Xác nhận áp dụng")).toBeFalsy();
    expect(findPackageInput(findCard(container, "Sữa tươi Vinamilk"), "Thùng 24 hộp").disabled).toBe(false);
  });

  it("names the unconfirmed items in the preview, rather than blocking the close", async () => {
    mocks.getStocktakeConfirmPreview.mockResolvedValue({ preview: previewResult() });
    const counted = packageLineItem({ id: "LINE-1", itemName: "Sữa tươi Vinamilk", countedQty: 48, theoreticalAtCount: 40 });
    const uncounted = legacyLineItem({ id: "LINE-2", itemName: "Đường cát" });
    const container = await renderTracked(
      <StocktakeClient session={session([counted, uncounted])} lastConfirmed={null} />,
    );

    await clickButtonWithText(container, "Xác nhận và áp dụng");

    expect(container.textContent).toContain("1 mặt hàng chưa xác nhận");
    expect(container.textContent).toContain("Đường cát");
  });
});
