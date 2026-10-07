// @vitest-environment jsdom
//
// Render tests for IssueSlipClient (OPEN-ITEMS 38).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { within } from "@testing-library/react";
import { IssueSlipClient } from "./IssueSlipClient";
import type { IssueSlipItemView } from "../actions";
import type { PackageLine } from "@/lib/stock/stocktake-package-lines";
import type { IssueSlipResult } from "@/lib/stock/manual-issue-transaction";

const mocks = vi.hoisted(() => ({
  createIssueSlip: vi.fn(),
  getIssueUnitCostsAt: vi.fn(),
  confirmDialog: vi.fn(),
  routerRefresh: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("../actions", () => ({
  createIssueSlip: mocks.createIssueSlip,
  getIssueUnitCostsAt: mocks.getIssueUnitCostsAt,
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: mocks.confirmDialog,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.routerPush }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/SaigonDateTimeInput", () => ({
  SaigonDateTimeInput: (p: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="issued-at" value={p.value} onChange={e => p.onChange(e.target.value)} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmDialog.mockResolvedValue(true);
  mocks.getIssueUnitCostsAt.mockResolvedValue({ unitCostByItem: {} });
});

if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.useRealTimers();
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
    expect(line?.textContent?.trim()).toBe("Tồn hiện tại: 0.48 Hop (48 g)");
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

  it("Cây 50 Cái selected against 1,000 Cái on hand shows 20 Cây (1,000 Cái), not 1,000 Cái", async () => {
    const container = await renderTracked(<IssueSlipClient items={[lyMap]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Ly mập Uchako");
    await selectPackage(block, "Cây 50 Cái");

    expect(onHandText(container)).toBe("Tồn hiện tại: 20 Cây (1,000 Cái)");
  });

  it("Cái 1 Cái selected (rate 1) shows the base figure alone, not doubled", async () => {
    const container = await renderTracked(<IssueSlipClient items={[lyMap]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Ly mập Uchako");
    await selectPackage(block, "Cái 1 Cái");

    expect(onHandText(container)).toBe("Tồn hiện tại: 1,000 Cái");
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

  // BR-UI-008 (owner 2026-10-07): the dot is the decimal mark typed into the
  // box. Before, the box dropped the dot, so "1.5" Thùng became 15 Thùng.
  it("typing 1.5 Thùng 12 hộp sends 18 hộp, not 180", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const theItem = item({
      packageLines: [
        pkg({ conversionId: "QD-001", sizeLabel: "Thùng 12 hộp", conversionRate: 12, purchasedUnitName: "Thùng" }),
      ],
    });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} />);
    const block = getLineBlocks(container)[0];

    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "1.5");
    expect(findQtyInput(block).value).toBe("1.5");
    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.lines).toEqual([{ purchasedItemId: "SPM-001", baseQuantity: 18 }]);
  });

  it("refuses a 4th decimal and drops a typed comma", async () => {
    const theItem = item({
      packageLines: [pkg({ conversionId: "QD-001", sizeLabel: "Thùng 12 hộp", conversionRate: 12, purchasedUnitName: "Thùng" })],
    });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");

    await setInputValue(findQtyInput(block), "1.234");
    await setInputValue(findQtyInput(block), "1.2345");
    expect(findQtyInput(block).value).toBe("1.234");

    await setInputValue(findQtyInput(block), "1,250");
    expect(findQtyInput(block).value).toBe("1250");
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    mocks.confirmDialog.mockResolvedValue(false);
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "2");
    const datetimeInput = container.querySelector('[data-testid="issued-at"]') as HTMLInputElement;
    await setInputValue(datetimeInput, "2026-06-01T09:00");

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(mocks.confirmDialog).toHaveBeenCalledTimes(1);
    const message = mocks.confirmDialog.mock.calls[0][0].message;
    expect(message).toContain("Tháng 6/2026");
    expect(message).toContain("Tháng 8/2026");
    expect(mocks.createIssueSlip).not.toHaveBeenCalled();
  });

  it("approving the confirm proceeds to call the RPC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "2");
    const datetimeInput = container.querySelector('[data-testid="issued-at"]') as HTMLInputElement;
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
    const datetimeInput = container.querySelector('[data-testid="issued-at"]') as HTMLInputElement;
    const initial = new Date(datetimeInput.value + ":00+07:00").getTime();
    expect(Math.abs(Date.now() - initial)).toBeLessThan(60_000);
  });

  it("the value sent to the RPC carries the typed time, not midnight", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const block = getLineBlocks(container)[0];
    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "2");
    const datetimeInput = container.querySelector('[data-testid="issued-at"]') as HTMLInputElement;
    const raw = "2026-08-17T14:30";
    await setInputValue(datetimeInput, raw);

    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.issuedAtIso).toBe("2026-08-17T07:30:00.000Z");
  });

  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z: default is 2026-09-15T06:30 and submit sends 2026-09-14T23:30:00.000Z", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
      const container = await renderTracked(<IssueSlipClient items={[item()]} />);
      const datetimeInput = container.querySelector('[data-testid="issued-at"]') as HTMLInputElement;
      expect(datetimeInput.value).toBe("2026-09-15T06:30");

      const block = getLineBlocks(container)[0];
      await selectItemInBlock(block, "Sữa tươi Vinamilk");
      await selectPackage(block, "Thùng 12 hộp");
      await setInputValue(findQtyInput(block), "2");

      await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

      expect(mocks.createIssueSlip).toHaveBeenCalledTimes(1);
      const call = mocks.createIssueSlip.mock.calls[0][0];
      expect(call.issuedAtIso).toBe("2026-09-14T23:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
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

describe("IssueSlipClient -- shares one time field across the whole slip (D9)", () => {
  it("stays at exactly one time box and zero reason selects as lines are added", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    await clickButtonWithText(container, "+ Thêm mặt hàng");
    await clickButtonWithText(container, "+ Thêm mặt hàng");

    const phoneBlock = container.querySelector<HTMLElement>(".md\\:hidden") ?? container;
    expect(within(phoneBlock).getAllByTestId("issued-at")).toHaveLength(1);
    expect(within(phoneBlock).getByText(/áp dụng cho cả phiếu/)).toBeTruthy();
    const phoneSelects = Array.from(phoneBlock.querySelectorAll("select"));
    const phoneLineSelects = getLineBlocks(phoneBlock).flatMap(b => Array.from(b.querySelectorAll("select")));
    expect(phoneSelects.length - phoneLineSelects.length).toBe(0);

    const desktopBlock = container.querySelector<HTMLElement>(".hidden.md\\:block");
    if (desktopBlock) {
      expect(within(desktopBlock).getAllByTestId("issued-at")).toHaveLength(1);
      expect(within(desktopBlock).getByText(/áp dụng cho cả phiếu/)).toBeTruthy();
      const desktopSelects = Array.from(desktopBlock.querySelectorAll("select"));
      const desktopLineSelects = Array.from(desktopBlock.querySelectorAll("tbody select"));
      expect(desktopSelects.length - desktopLineSelects.length).toBe(0);
    }
  });
});

describe("IssueSlipClient -- removes Lý do and Chi tiết fields", () => {
  it("does not render Lý do or Chi tiết texts", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    expect(container.textContent).not.toContain("Lý do");
    expect(container.textContent).not.toContain("Chi tiết (không bắt buộc)");
  });

  it("submits the RPC with note: ''", async () => {
    mocks.createIssueSlip.mockResolvedValue({ result: submittedResult() });
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const block = getLineBlocks(container)[0];

    await selectItemInBlock(block, "Sữa tươi Vinamilk");
    await selectPackage(block, "Thùng 12 hộp");
    await setInputValue(findQtyInput(block), "3");
    await clickButtonWithText(container, "Ghi phiếu xuất (1 dòng)");

    expect(mocks.createIssueSlip).toHaveBeenCalledTimes(1);
    const call = mocks.createIssueSlip.mock.calls[0][0];
    expect(call.note).toBe("");
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

describe("IssueSlipClient -- Số lượng field sizing (D10)", () => {
  it("the Số lượng field carries the compact w-24 width class (class presence, not measured width)", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const qtyInput = findQtyInput(getLineBlocks(container)[0]);
    expect(qtyInput.closest(".w-24")).toBeTruthy();
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

describe("IssueSlipClient -- Responsive redesign (desktop table & mobile cards)", () => {
  it("desktop block contains a <table> whose header cells read Mặt hàng, Tồn hiện tại, Đơn vị, Số lượng, Quy ra", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const desktop = container.querySelector(".hidden.md\\:block");
    expect(desktop).toBeTruthy();
    const table = desktop!.querySelector("table");
    expect(table).toBeTruthy();
    const headerTexts = Array.from(table!.querySelectorAll("th")).map(th => th.textContent?.trim());
    expect(headerTexts).toContain("Mặt hàng");
    expect(headerTexts).toContain("Tồn hiện tại");
    expect(headerTexts).toContain("Đơn vị");
    expect(headerTexts).toContain("Số lượng");
    expect(headerTexts).toContain("Quy ra");
  });

  it("after choosing an item with a package option (factor e.g. 12) and typing quantity '2', the desktop 'Quy ra' cell shows '24 <base unit>'; the phone card shows the same text", async () => {
    const theItem = item({
      unitName: "hộp",
      packageLines: [
        pkg({
          conversionId: "QD-001",
          sizeLabel: "Thùng 12 hộp",
          conversionRate: 12,
          purchasedUnitName: "Thùng",
          baseUnitName: "hộp",
        }),
      ],
    });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} />);
    const desktop = container.querySelector<HTMLElement>(".hidden.md\\:block")!;
    const phone = container.querySelector<HTMLElement>(".md\\:hidden")!;

    await selectItemInBlock(desktop, "Sữa tươi Vinamilk");
    await selectPackage(desktop, "Thùng 12 hộp");
    const desktopQtyInput = desktop.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    await setInputValue(desktopQtyInput, "2");

    // Desktop "Quy ra" cell shows "24 hộp"
    const desktopTable = desktop.querySelector("table")!;
    const quyRaHeaderIndex = Array.from(desktopTable.querySelectorAll("th")).findIndex(
      th => th.textContent?.trim() === "Quy ra",
    );
    expect(quyRaHeaderIndex).toBeGreaterThanOrEqual(0);
    const firstRowCells = desktopTable.querySelectorAll("tbody tr")[0].querySelectorAll("td");
    expect(firstRowCells[quyRaHeaderIndex].textContent?.trim()).toBe("24 hộp");

    // Phone card shows the same text "24 hộp"
    const phoneCards = getLineBlocks(phone);
    expect(phoneCards[0].textContent).toContain("24 hộp");
  });

  it("a 'Quay lại' link to /admin/inventory/issue-slips exists", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const backLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href="/admin/inventory/issue-slips"]'),
    );
    expect(backLinks.length).toBeGreaterThanOrEqual(1);
    const hasQuayLai = backLinks.some(link => link.textContent?.trim() === "Quay lại");
    expect(hasQuayLai).toBe(true);
  });

  it("'✕' is absent with one line, present after '+ Thêm mặt hàng'", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const desktop = container.querySelector<HTMLElement>(".hidden.md\\:block")!;
    const phone = container.querySelector<HTMLElement>(".md\\:hidden")!;

    expect(desktop.querySelector('button[aria-label="Xoá dòng"]')).toBeNull();
    expect(phone.querySelector('button[aria-label="Xoá dòng"]')).toBeNull();

    await clickButtonWithText(container, "+ Thêm mặt hàng");

    expect(desktop.querySelectorAll('button[aria-label="Xoá dòng"]').length).toBeGreaterThanOrEqual(1);
    expect(phone.querySelectorAll('button[aria-label="Xoá dòng"]').length).toBeGreaterThanOrEqual(1);
  });
});

describe("IssueSlipClient -- Row 3 Giá trị xuất", () => {
  it("header 'Giá trị xuất' exists in desktop table", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    const desktop = container.querySelector(".hidden.md\\:block");
    expect(desktop).toBeTruthy();
    const ths = Array.from(desktop!.querySelectorAll("th")).map(th => th.textContent?.trim());
    expect(ths).toContain("Giá trị xuất");
  });

  it("with unit cost 1500 per base unit and a 12-factor package × quantity 2 shows 36,000đ on desktop and phone", async () => {
    mocks.getIssueUnitCostsAt.mockResolvedValue({
      unitCostByItem: { "SPM-001": 1500 },
    });
    const theItem = item({
      id: "SPM-001",
      unitName: "hộp",
      packageLines: [
        pkg({
          conversionId: "QD-001",
          sizeLabel: "Thùng 12 hộp",
          conversionRate: 12,
          purchasedUnitName: "Thùng",
          baseUnitName: "hộp",
        }),
      ],
    });
    const container = await renderTracked(<IssueSlipClient items={[theItem]} />);
    const desktop = container.querySelector<HTMLElement>(".hidden.md\\:block")!;
    const phone = container.querySelector<HTMLElement>(".md\\:hidden")!;

    await selectItemInBlock(desktop, "Sữa tươi Vinamilk");
    await selectPackage(desktop, "Thùng 12 hộp");
    const desktopQtyInput = desktop.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    await setInputValue(desktopQtyInput, "2");

    // Desktop table row contains 36.000đ
    const desktopTable = desktop.querySelector("table")!;
    const giaTriHeaderIndex = Array.from(desktopTable.querySelectorAll("th")).findIndex(
      th => th.textContent?.trim() === "Giá trị xuất",
    );
    expect(giaTriHeaderIndex).toBeGreaterThanOrEqual(0);
    const firstRowCells = desktopTable.querySelectorAll("tbody tr")[0].querySelectorAll("td");
    expect(firstRowCells[giaTriHeaderIndex].textContent?.trim()).toBe("36,000đ");

    // Phone card contains 36.000đ
    const phoneCards = getLineBlocks(phone);
    expect(phoneCards[0].textContent).toContain("Giá trị xuất:");
    expect(phoneCards[0].textContent).toContain("36,000đ");
  });

  it("total row shows the rounded exact sum of two lines (where sum of rounded cells would differ by 1)", async () => {
    // line 1: unitCost = 100.4, qty 1, factor 1 -> value = 100.4 (rounded cell = 100)
    // line 2: unitCost = 200.4, qty 1, factor 1 -> value = 200.4 (rounded cell = 200)
    // sum of rounded cells = 300, exact sum = 300.8 -> rounded exact sum = 301
    mocks.getIssueUnitCostsAt.mockResolvedValue({
      unitCostByItem: {
        "SPM-001": 100.4,
        "SPM-002": 200.4,
      },
    });
    const items2 = [
      item({
        id: "SPM-001",
        name: "Mặt hàng 1",
        unitName: "g",
        packageLines: [pkg({ conversionId: "QD-001", sizeLabel: "Gói 1g", conversionRate: 1, baseUnitName: "g" })],
      }),
      item({
        id: "SPM-002",
        name: "Mặt hàng 2",
        unitName: "g",
        packageLines: [pkg({ conversionId: "QD-002", sizeLabel: "Gói 1g", conversionRate: 1, baseUnitName: "g" })],
      }),
    ];
    const container = await renderTracked(<IssueSlipClient items={items2} />);
    const desktop = container.querySelector<HTMLElement>(".hidden.md\\:block")!;
    const phone = container.querySelector<HTMLElement>(".md\\:hidden")!;

    await selectItemInBlock(desktop, "Mặt hàng 1");
    await selectPackage(desktop, "Gói 1g");
    const qty1 = desktop.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')[0];
    await setInputValue(qty1, "1");

    await clickButtonWithText(desktop, "+ Thêm mặt hàng");
    const line2 = desktop.querySelectorAll("tbody tr")[1];
    await selectItemInBlock(line2 as HTMLElement, "Mặt hàng 2");
    await selectPackage(line2 as HTMLElement, "Gói 1g");
    const qty2 = desktop.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')[1];
    await setInputValue(qty2, "1");

    // Total on desktop table shows 301đ
    expect(desktop.textContent).toContain("Tổng giá trị xuất");
    expect(desktop.textContent).toContain("301đ");
    // Total on phone shows 301đ
    expect(phone.textContent).toContain("Tổng giá trị xuất:");
    expect(phone.textContent).toContain("301đ");
  });

  it("an item absent from unitCostByItem shows '—' and the 'chưa tính 1 dòng chưa có giá' note", async () => {
    // Only SPM-001 has cost; SPM-002 does not
    mocks.getIssueUnitCostsAt.mockResolvedValue({
      unitCostByItem: { "SPM-001": 1000 },
    });
    const items2 = [
      item({
        id: "SPM-001",
        name: "Có giá",
        unitName: "hộp",
        packageLines: [pkg({ conversionId: "QD-001", sizeLabel: "Hộp 1", conversionRate: 1, baseUnitName: "hộp" })],
      }),
      item({
        id: "SPM-002",
        name: "Không có giá",
        unitName: "hộp",
        packageLines: [pkg({ conversionId: "QD-002", sizeLabel: "Hộp 1", conversionRate: 1, baseUnitName: "hộp" })],
      }),
    ];
    const container = await renderTracked(<IssueSlipClient items={items2} />);
    const desktop = container.querySelector<HTMLElement>(".hidden.md\\:block")!;
    const phone = container.querySelector<HTMLElement>(".md\\:hidden")!;

    await selectItemInBlock(desktop, "Có giá");
    await selectPackage(desktop, "Hộp 1");
    const qty1 = desktop.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')[0];
    await setInputValue(qty1, "1");

    await clickButtonWithText(desktop, "+ Thêm mặt hàng");
    const line2 = desktop.querySelectorAll("tbody tr")[1];
    await selectItemInBlock(line2 as HTMLElement, "Không có giá");
    await selectPackage(line2 as HTMLElement, "Hộp 1");
    const qty2 = desktop.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')[1];
    await setInputValue(qty2, "1");

    // Line 2 desktop Giá trị xuất column shows "—"
    const desktopTable = desktop.querySelector("table")!;
    const giaTriHeaderIndex = Array.from(desktopTable.querySelectorAll("th")).findIndex(
      th => th.textContent?.trim() === "Giá trị xuất",
    );
    const row2Cells = desktopTable.querySelectorAll("tbody tr")[1].querySelectorAll("td");
    expect(row2Cells[giaTriHeaderIndex].textContent?.trim()).toBe("—");

    // Note appears on both desktop and phone
    expect(desktop.textContent).toContain("chưa tính 1 dòng chưa có giá");
    expect(phone.textContent).toContain("chưa tính 1 dòng chưa có giá");
  });

  it("changing the time calls getIssueUnitCostsAt again with the new ISO date", async () => {
    const container = await renderTracked(<IssueSlipClient items={[item()]} />);
    expect(mocks.getIssueUnitCostsAt).toHaveBeenCalledTimes(1);

    const datetimeInput = container.querySelector('[data-testid="issued-at"]') as HTMLInputElement;
    await setInputValue(datetimeInput, "2026-08-17T15:00");

    expect(mocks.getIssueUnitCostsAt).toHaveBeenCalledTimes(2);
    const secondCallArg = mocks.getIssueUnitCostsAt.mock.calls[1][0];
    expect(secondCallArg).toBe(new Date("2026-08-17T15:00:00+07:00").toISOString());
  });
});


