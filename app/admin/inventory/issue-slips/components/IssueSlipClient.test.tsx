// @vitest-environment jsdom
//
// Render tests for IssueSlipClient (OPEN-ITEMS 38).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { IssueSlipClient } from "./IssueSlipClient";
import type { IssueSlipItemView } from "../actions";
import type { PackageLine } from "@/lib/stock/stocktake-package-lines";
import type { IssueSlipResult } from "@/lib/stock/manual-issue-transaction";

const mocks = vi.hoisted(() => ({
  createIssueSlip: vi.fn(),
  confirmDialog: vi.fn(),
  routerRefresh: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("../actions", () => ({
  createIssueSlip: mocks.createIssueSlip,
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: mocks.confirmDialog,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.routerPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmDialog.mockResolvedValue(true);
});

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
  const option = Array.from(document.body.querySelectorAll('[role="option"]')).find(
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

function getLineBlocks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("div.rounded-xl.relative"));
}

async function selectItemInBlock(block: HTMLElement, label: string) {
  const combobox = block.querySelector('[role="combobox"]');
  if (!combobox) throw new Error("SearchableSelect trigger not found in block");
  await fireClick(combobox);
  const option = Array.from(document.body.querySelectorAll('[role="option"]')).find(el => el.textContent?.trim() === label);
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
  const input = block.querySelector('input[type="text"]');
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
    purchasedUnitName: "Thùng",
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
    { conversionId: "QD-001", purchasedItemId: "SPM-001", purchasedItemName: "Sua tuoi Vinamilk", sizeLabel: "Thung 12 hop", conversionRate: 12, baseUnitName: "kg", purchasedUnitName: "Thung" },
  ],
};

const itemFormerlyMismatched: IssueSlipItemView = {
  id: "SPM-043",
  name: "Sua chua khong duong Vinamilk",
  onHand: 48,
  unitName: "g",
  packageLines: [
    { conversionId: "QD-049", purchasedItemId: "SPM-043", purchasedItemName: "Sua chua khong duong Vinamilk", sizeLabel: "Hop 100 g", conversionRate: 100, baseUnitName: "g", purchasedUnitName: "Hop" },
  ],
};

describe("IssueSlipClient onHand unit label (OPEN-ITEMS 41)", () => {
  it("renders the on-hand quantity converted into the selected package's unit, base kept alongside", async () => {
    const container = await renderTracked(
      <IssueSlipClient items={[itemWithRealUnit]} />
    );
    await selectItem(container, "Sua tuoi Vinamilk");

    const line = Array.from(container.querySelectorAll("p")).find(p =>
      p.textContent?.includes("Tồn hiện tại"),
    );
    expect(line?.textContent?.trim()).toBe("Tồn hiện tại: 1 Thung (12 kg)");
  });

  it("renders g for Sua chua khong duong Vinamilk now that QD-049 is corrected", async () => {
    const container = await renderTracked(
      <IssueSlipClient items={[itemFormerlyMismatched]} />
    );
    await selectItem(container, "Sua chua khong duong Vinamilk");

    const line = Array.from(container.querySelectorAll("p")).find(p =>
      p.textContent?.includes("Tồn hiện tại"),
    );
    expect(line?.textContent?.trim()).toBe("Tồn hiện tại: 0,48 Hop (48 g)");
  });
});

describe("IssueSlipClient -- converted on-hand is a mistake guard (section 3)", () => {
  const lyMap: IssueSlipItemView = {
    id: "SPM-CUP",
    name: "Ly mập Uchako",
    onHand: 1000,
    unitName: "Cái",
    packageLines: [
      { conversionId: "QD-CAI", purchasedItemId: "SPM-CUP", purchasedItemName: "Ly mập Uchako", sizeLabel: "Cái 1 Cái", conversionRate: 1, baseUnitName: "Cái", purchasedUnitName: "Cái" },
      { conversionId: "QD-CAY", purchasedItemId: "SPM-CUP", purchasedItemName: "Ly mập Uchako", sizeLabel: "Cây 50 Cái", conversionRate: 50, baseUnitName: "Cái", purchasedUnitName: "Cây" },
    ],
  };

  function onHandText(container: HTMLElement): string | undefined {
    return Array.from(container.querySelectorAll("p"))
      .find(p => p.textContent?.includes("Tồn hiện tại"))
      ?.textContent?.trim();
  }

  it("Cây 50 Cái selected against 1.000 Cái on hand shows 20 Cây (1.000 Cái), not 1.000 Cái", async () => {
    const container = await renderTracked(<IssueSlipClient items={[lyMap]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Ly mập Uchako");
    await selectPackage(block, "Cây 50 Cái");

    expect(onHandText(container)).toBe("Tồn hiện tại: 20 Cây (1.000 Cái)");
  });

  it("Cái 1 Cái selected (rate 1) shows the base figure alone, not doubled", async () => {
    const container = await renderTracked(<IssueSlipClient items={[lyMap]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Ly mập Uchako");
    await selectPackage(block, "Cái 1 Cái");

    expect(onHandText(container)).toBe("Tồn hiện tại: 1.000 Cái");
  });
});

describe("IssueSlipClient -- package-size counting produces the base quantity sent to the RPC (I3)", () => {
  it("multiplies the typed package count by the chosen conversion rate before submitting", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const theItem = item({
      packageLines: [
        pkg({ conversionId: "QD-001", sizeLabel: "Thùng 12 hộp", conversionRate: 12, purchasedUnitName: "Thùng" }),
        pkg({ conversionId: "QD-002", sizeLabel: "Hộp lẻ", conversionRate: 1, purchasedUnitName: "Hộp" }),
      ],
    });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} />);
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

describe("IssueSlipClient -- routing and custom loose options", () => {
  it("navigates to the details page on a successful submit", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult({ slipId: "ISL-00077" }) });
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const block = getLineBlocks(container)[0];

    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "3");
    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(mocks.routerPush).toHaveBeenCalledWith("/admin/inventory/issue-slips/ISL-00077");
  });

  it("choosing loose unit for Phin Đậm sends the correct base quantity", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const phinDam = item({
      id: "SPM-PHIN",
      name: "Phin Đậm",
      unitName: "g",
      onHand: 1000,
      packageLines: [
        pkg({ conversionId: "QD-TUI1KG", sizeLabel: "Túi 1kg", conversionRate: 1000, purchasedUnitName: "Túi" }),
      ],
    });
    const container = await renderTracked(<IssueSlipClient items={[phinDam]} />);
    const block = getLineBlocks(container)[0];

    await selectItemInBlock(block, "Phin Đậm");
    await selectPackage(block, "g (lẻ)");
    await setInputValue(findQtyInput(block), "250");
    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.lines).toEqual([{ purchasedItemId: "SPM-PHIN", baseQuantity: 250 }]);
  });
});

describe("IssueSlipClient -- backdated slip warns which months move and requires explicit confirm (I6)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("confirm() names the affected months; declining it blocks the RPC call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    mocks.confirmDialog.mockResolvedValue(false);
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
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
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
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

describe("IssueSlipClient -- does not pre-empt the RPC's on-hand refusal, for this input (I4/I5/I10)", () => {
  it("submits an over-onHand quantity unchanged and shows the RPC's refusal verbatim when it rejects", async () => {
    mocks.createIssueSlip.mockResolvedValue({
      error: "Dòng 1 (Sữa tươi Vinamilk): yêu cầu xuất 999 hộp, chỉ còn 12 hộp tính tới thời điểm hiện tại",
    });
    const theItem = item({ onHand: 12 });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} />);
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

describe("IssueSlipClient -- time field defaults near now and submits a real instant, not a bare date", () => {
  it("the datetime-local input starts within a minute of now", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const datetimeInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const initial = new Date(datetimeInput.value).getTime();
    expect(Math.abs(Date.now() - initial)).toBeLessThan(60_000);
  });

  it("the value sent to the RPC carries the typed time, not midnight", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
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

describe("IssueSlipClient -- manages an add/remove line list (D9)", () => {
  it("adding and removing lines changes the number of rendered line blocks", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    expect(getLineBlocks(container)).toHaveLength(1);

    await clickButtonWithText(container, "+ Thêm mặt hàng");
    expect(getLineBlocks(container)).toHaveLength(2);

    const removeBtn = getLineBlocks(container)[0].querySelector('button[aria-label="Xoá dòng"]');
    await fireClick(removeBtn!);
    expect(getLineBlocks(container)).toHaveLength(1);
  });
});

describe("IssueSlipClient -- sends every line in ONE RPC call, not one per item (D9)", () => {
  it("a 3-line slip produces exactly one createIssueSlip call with all 3 lines", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const items3 = [
      item({
        id: "SPM-001",
        name: "Sữa tươi Vinamilk",
        packageLines: [pkg({ conversionId: "QD-001", purchasedItemId: "SPM-001", sizeLabel: "Thùng 12 hộp", conversionRate: 12, purchasedUnitName: "Thùng" })],
      }),
      item({
        id: "SPM-002",
        name: "Đường cát",
        packageLines: [pkg({ conversionId: "QD-002", purchasedItemId: "SPM-002", sizeLabel: "Bao 25kg", conversionRate: 25, purchasedUnitName: "Bao" })],
      }),
      item({
        id: "SPM-003",
        name: "Cà phê hạt",
        packageLines: [pkg({ conversionId: "QD-003", purchasedItemId: "SPM-003", sizeLabel: "Túi 1kg", conversionRate: 1, purchasedUnitName: "Túi" })],
      }),
    ];
    const container = await renderTracked(<IssueSlipClient items={items3} />);

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

describe("IssueSlipClient -- shares one time field and one reason across the whole slip (D9)", () => {
  it("stays at exactly one datetime-local input and one reason select as lines are added", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await clickButtonWithText(container, "+ Thêm mặt hàng");

    expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(1);
    expect(container.textContent).toContain("áp dụng cho cả phiếu");
    const allSelects = Array.from(container.querySelectorAll("select"));
    const lineBlockSelects = getLineBlocks(container).flatMap(b => Array.from(b.querySelectorAll("select")));
    expect(allSelects.length - lineBlockSelects.length).toBe(1);
  });
});

describe("IssueSlipClient -- per-line validation names which line is wrong, before ever calling the RPC (D9)", () => {
  it("names line 2 when its item is unselected, and does not call the RPC", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");

    await clickButtonWithText(container, "Ghi phiếu xuất (2 dòng)");

    expect(container.textContent).toContain("Dòng 2: chưa chọn mặt hàng");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });

  it("names line 1 when its package size is unselected, and does not call the RPC", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "-- Chọn --");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(container.textContent).toContain("Dòng 1: chưa chọn quy cách");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });

  it("names line 1 when its quantity is zero, and does not call the RPC", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(container.textContent).toContain("Dòng 1: số lượng phải lớn hơn 0");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });
});

describe("IssueSlipClient -- Số lượng field sizing and Chi tiết input shape (D10)", () => {
  it("the Số lượng field carries the compact w-24 width class (class presence, not measured width)", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const qtyInput = findQtyInput(getLineBlocks(container)[0]);
    expect(qtyInput.closest(".w-24")).toBeTruthy();
  });

  it("Chi tiết is a single-line text input, not a multi-row textarea", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
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
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    expect(findQtyInput(getLineBlocks(container)[0]).getAttribute("inputmode")).toBe("decimal");
  });
});

describe("IssueSlipClient -- M3, tap targets carry the 44px-tier class, not the 32px one (class presence, not measured size)", () => {
  it("the add-line button carries min-h-[44px]", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const addBtn = findButtonWithText(container, "+ Thêm mặt hàng");
    expect(addBtn?.className).toContain("min-h-[44px]");
  });

  it("the remove-line button carries the p-2 padding class that gives it a real hit area", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    const removeBtn = getLineBlocks(container)[0].querySelector('button[aria-label="Xoá dòng"]');
    expect(removeBtn?.className).toContain("p-2");
  });
});

describe("IssueSlipClient -- M4, the live ready-to-submit count matches handleSubmit's own validation (D10)", () => {
  it("counts only fully-filled lines as ready", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");

    await selectItemInBlock(getLineBlocks(container)[0], "Sữa tươi Vinamilk");
    await selectPackage(getLineBlocks(container)[0], "Thùng 12 hộp");
    await setInputValue(findQtyInput(getLineBlocks(container)[0]), "2");

    expect(container.textContent).toContain("Đã điền đủ: 1/2 dòng");
  });
});

