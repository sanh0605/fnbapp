// @vitest-environment jsdom
//
// Tests for Bug C6: the promo-code button never applies a per-dish promotion.
// Around lines 431, 509, 582, code called .includes(item.variant_id) on applicable list.
// For per-dish promotions, applicable_products_json is an object (map from variant_id to price/val),
// so .includes threw and the promo code was never applied.
// Fix: accept both shapes (array of variant ids, or object whose keys are variant ids).

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import POSScreen from "./POSScreen";
import { formatNumber } from "@/lib/shared/format";

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn(async () => []),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(async () => ({ success: true })),
}));

import { getPOSDrafts } from "@/app/pos/actions";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  (getPOSDrafts as any).mockResolvedValue([]);
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
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
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

async function openDraftsModal() {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.includes("Nháp"),
  );
  if (!btn) throw new Error("Nháp button not found");
  await fireClick(btn);
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function draftCard(name: string): HTMLElement {
  const nameEl = Array.from(document.querySelectorAll("p")).find(
    p => p.textContent === name,
  );
  if (!nameEl) throw new Error(`draft card not found: "${name}"`);
  return nameEl.parentElement!.parentElement as HTMLElement;
}

async function clickButtonInCard(card: HTMLElement, text: string) {
  const btn = Array.from(card.querySelectorAll("button")).find(
    b => b.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`"${text}" button not found in card`);
  await fireClick(btn);
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function promoInput(): HTMLInputElement {
  const input = document.querySelector('input[aria-label="Mã giảm giá"]');
  if (!input) throw new Error("promo code input not found");
  return input as HTMLInputElement;
}

const CATEGORY = { id: "CAT1", name: "Cà phê" };

function makeDraftRow(id: string, name: string, cart: any[]) {
  return {
    id,
    name,
    created_at: "2026-08-14T08:00:00Z",
    cart_json: JSON.stringify(cart),
    created_by_name: "Thu",
  };
}

const CART_ITEM_V1 = {
  id: "L1",
  product_id: "P1",
  product_name: "Cà phê đen",
  variant_id: "V1",
  size_name: "M",
  unit_price: 30000,
  modifiers: [],
  qty: 1,
  discount_amount: 0,
  discount_type: "VND",
};

describe("Bug C6: Per-dish promotion with object-shaped applicable list", () => {
  it("applies a per-dish promotion whose applicable_products_json is an object map of variant IDs", async () => {
    const promo = {
      id: "PROMO_DISH_OBJECT",
      name: "Giảm 50% Cà phê đen",
      code: "CFDEN50",
      type: "PRODUCT_DISCOUNT",
      status: "ACTIVE",
      discount_type: "PERCENT",
      discount_value: 50,
      start_date: "2020-01-01",
      end_date: "2030-01-01",
      // Object map shape: keys are variant IDs, values are custom values
      applicable_products_json: JSON.stringify({ V1: 50 }),
    };

    (getPOSDrafts as any).mockResolvedValue([
      makeDraftRow("D1", "Đơn một", [CART_ITEM_V1]),
    ]);

    await renderTracked(
      <POSScreen
        brandId="BRAND1"
        outletId="OUT-001"
        categories={[CATEGORY]}
        products={[]}
        variants={[]}
        modifiers={[]}
        promotions={[promo]}
      />,
    );

    // 1. Load draft into cart
    await openDraftsModal();
    await clickButtonInCard(draftCard("Đơn một"), "Nạp");
    expect(document.body.textContent).toContain("Cà phê đen");

    // 2. Type promo code into the input
    await setInputValue(promoInput(), "CFDEN50");

    // 3. Click "Áp dụng" button
    const applyBtn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "Áp dụng",
    );
    expect(applyBtn).toBeDefined();

    await fireClick(applyBtn!);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // 4. Verify promo was applied successfully
    // On the old code, this threw TypeError and never showed "Đã áp dụng" or the promo name
    expect(document.body.textContent).toContain("Đã áp dụng");
    expect(document.body.textContent).toContain("Giảm 50% Cà phê đen");
    // 50% of 30,000 = 15,000
    expect(document.body.textContent).toContain(formatNumber(15000));
  });

  it("still applies a promotion whose applicable_products_json is an array of variant IDs", async () => {
    const promo = {
      id: "PROMO_DISH_ARRAY",
      name: "Giảm 10k Cà phê đen",
      code: "CFDEN10K",
      type: "PRODUCT_DISCOUNT",
      status: "ACTIVE",
      discount_type: "VND",
      discount_value: 10000,
      start_date: "2020-01-01",
      end_date: "2030-01-01",
      // Array shape
      applicable_products_json: JSON.stringify(["V1"]),
    };

    (getPOSDrafts as any).mockResolvedValue([
      makeDraftRow("D1", "Đơn một", [CART_ITEM_V1]),
    ]);

    await renderTracked(
      <POSScreen
        brandId="BRAND1"
        outletId="OUT-001"
        categories={[CATEGORY]}
        products={[]}
        variants={[]}
        modifiers={[]}
        promotions={[promo]}
      />,
    );

    await openDraftsModal();
    await clickButtonInCard(draftCard("Đơn một"), "Nạp");

    await setInputValue(promoInput(), "CFDEN10K");

    const applyBtn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "Áp dụng",
    );
    await fireClick(applyBtn!);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(document.body.textContent).toContain("Đã áp dụng");
    expect(document.body.textContent).toContain("Giảm 10k Cà phê đen");
    expect(document.body.textContent).toContain(formatNumber(10000));
  });
});
