// @vitest-environment jsdom
//
// Tests for Bug C2 / BR-SALE-015:
// The offline pending queue is removed (the till does not sell offline).
// Live behaviour: the header does not show any pending orders badge.

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import POSScreen from "./POSScreen";

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(async () => ({ success: true })),
  getPOSDrafts: vi.fn(async () => []),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(async () => ({ success: true })),
}));

import { submitOrderV2, getPOSDrafts } from "@/app/pos/actions";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

beforeEach(() => {
  Object.defineProperty(window.navigator, "onLine", {
    value: true,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  (getPOSDrafts as any).mockResolvedValue([]);
  (submitOrderV2 as any).mockResolvedValue({ success: true });

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

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

async function renderTracked(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  await flush();
  return container;
}

const CATEGORY = { id: "CAT1", name: "Cà phê" };
const PRODUCT = { id: "P1", name: "Cà phê đen", category_id: CATEGORY.id };
const VARIANTS = [{ id: "V1", product_id: "P1", size_name: "M", price: 20000 }];

describe("Bug C2 / BR-SALE-015: No offline queue badge", () => {
  it("does not display any pending orders badge in the header", async () => {
    await renderTracked(
      <POSScreen
        brandId="BRAND1"
        outletId="OUT-001"
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
      />,
    );

    const header = document.querySelector("header");
    expect(header?.textContent).not.toContain("đơn chờ gửi");
  });
});
