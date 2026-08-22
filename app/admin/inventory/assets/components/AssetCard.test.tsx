// @vitest-environment jsdom
//
// Render test (OPEN-ITEMS 38/46's limit -- render assertion, no submission
// needed to check what a card displays) for the "one card per asset" shape
// section 5.1 asks for: bucket label, remaining quantity, remaining value.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { AssetCard } from "./AssetCard";
import type { AssetView } from "../actions";

vi.mock("../actions", () => ({
  disposeAsset: vi.fn(),
  previewDisposalCharge: vi.fn(),
}));

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  while (roots.length) {
    const root = roots.pop()!;
    act(() => { root.unmount(); });
  }
  while (containers.length) {
    containers.pop()!.remove();
  }
});

async function renderTracked(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  roots.push(root);
  containers.push(container);
  return container;
}

const BASE_ASSET: AssetView = {
  id: "TS-001",
  name: "Bình nhựa có bơm 1000ml",
  quantity: 8,
  remainingQuantity: 8,
  acquiredDate: "2026-01-15",
  unitCost: 95_150,
  totalCost: 761_200,
  termMonths: 12,
  remainingValue: 634_367,
  bucket: "IN_USE",
};

describe("AssetCard", () => {
  it("shows the Vietnamese bucket label and remaining value for an in-use asset", async () => {
    const container = await renderTracked(<AssetCard asset={BASE_ASSET} />);

    expect(container.textContent).toContain("Còn dùng");
    expect(container.textContent).toContain("Bình nhựa có bơm 1000ml");
    expect(container.textContent).toContain("8 / 8 cái");
    expect(container.textContent).toContain("634.367đ");
    expect(container.textContent).toContain("12 tháng");
  });

  it("shows 'Đã hết khấu hao' and offers no disposal action changes when fully depreciated, still owned", async () => {
    const container = await renderTracked(
      <AssetCard asset={{ ...BASE_ASSET, bucket: "FULLY_DEPRECIATED", remainingValue: 0 }} />,
    );

    expect(container.textContent).toContain("Đã hết khấu hao");
    expect(container.textContent).toContain("0đ");
    // Still offered for disposal -- the shop still owns it (section 1).
    expect(container.textContent).toContain("Đánh dấu hỏng / thanh lý");
  });

  it("shows 'Đã thanh lý' and hides the disposal action once fully disposed", async () => {
    const container = await renderTracked(
      <AssetCard asset={{ ...BASE_ASSET, bucket: "DISPOSED", remainingQuantity: 0, remainingValue: 0 }} />,
    );

    expect(container.textContent).toContain("Đã thanh lý");
    expect(container.textContent).not.toContain("Đánh dấu hỏng / thanh lý");
  });
});
