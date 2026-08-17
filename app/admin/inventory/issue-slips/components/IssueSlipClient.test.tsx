// @vitest-environment jsdom
//
// Render test for OPEN-ITEMS 41: the "Ton hien tai" line on the issue-slip
// screen (IssueSlipClient.tsx:234) used to always render a bare number
// because purchased_items.default_unit_id is null on every row (actions.ts
// used to read unitNameById.get(p.default_unit_id)). getIssueSlipFormData
// now sources the label from UOM_Conversions.base_unit instead (same fix as
// G4, 7882894), except for the one item whose conversion disagrees with its
// own ingredient's canonical unit -- that item is left blank on purpose.
//
// OPEN-ITEMS 38: a test that greps source text cannot see a wrong render.
// This renders the real component and reads the DOM, following the
// createRoot + act pattern from components/POSScreen.itemModal.test.tsx and
// components/ProductForm.test.tsx.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { IssueSlipClient } from "./IssueSlipClient";
import type { IssueSlipItemView } from "../actions";

vi.mock("../actions", () => ({
  createIssueSlip: vi.fn(),
  reverseIssueSlip: vi.fn(),
  cancelIssueSlip: vi.fn(),
}));

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

const itemWithRealUnit: IssueSlipItemView = {
  id: "SPM-001",
  name: "Sua tuoi Vinamilk",
  onHand: 12,
  unitName: "kg",
  packageLines: [
    { conversionId: "QD-001", purchasedItemId: "SPM-001", purchasedItemName: "Sua tuoi Vinamilk", sizeLabel: "Thung 12 hop", conversionRate: 12, baseUnitName: "kg" },
  ],
};

// Mirrors the real SPM-043 case: the fix deliberately leaves unitName blank
// when the item's conversion disagrees with its own ingredient's base unit,
// rather than showing a confidently wrong label.
const itemWithBlankUnit: IssueSlipItemView = {
  id: "SPM-043",
  name: "Sua chua khong duong Vinamilk",
  onHand: 48,
  unitName: "",
  packageLines: [
    { conversionId: "QD-049", purchasedItemId: "SPM-043", purchasedItemName: "Sua chua khong duong Vinamilk", sizeLabel: "Hop 100g", conversionRate: 100, baseUnitName: "" },
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

  it("stays blank rather than showing a wrong unit for the known SPM-043 case", async () => {
    const container = await renderTracked(
      <IssueSlipClient items={[itemWithBlankUnit]} recentSlips={[]} />,
    );
    await selectItem(container, "Sua chua khong duong Vinamilk");

    const line = Array.from(container.querySelectorAll("p")).find(p =>
      p.textContent?.includes("Tồn hiện tại"),
    );
    expect(line?.textContent?.trim()).toBe("Tồn hiện tại: 48");
  });
});
