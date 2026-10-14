// @vitest-environment jsdom
//
// Tests for Bug C7: loading a draft can delete the wrong draft (double charge).
// When cart already has items, loadDraft must await saveDraft(cart, false) before
// loading the chosen draft; if save fails, it must abort and show an error toast
// "Không lưu được giỏ hiện tại, chưa mở đơn nháp".

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import POSScreen from "./POSScreen";

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn(async () => []),
  savePOSDraft: vi.fn(async () => ({ success: true, draft: { id: "D_NEW", name: "New Draft" } })),
  deletePOSDraft: vi.fn(async () => ({ success: true })),
  reportPosSyncFailure: vi.fn(),
}));

vi.mock("@/lib/pos/pos-offline-queue", () => ({
  enqueuePendingOrder: vi.fn(),
  incrementAttemptCount: vi.fn(),
  listPendingOrders: vi.fn(async () => []),
  removePendingOrder: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(async () => {}),
  confirm: vi.fn(async () => true),
}));

import { getPOSDrafts, savePOSDraft } from "@/app/pos/actions";
import { confirm } from "@/lib/shared/dialog";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  (getPOSDrafts as any).mockResolvedValue([]);
  (savePOSDraft as any).mockResolvedValue({ success: true, draft: { id: "D_NEW", name: "New Draft" } });
  (confirm as any).mockResolvedValue(true);
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

const CART_ITEM_1 = {
  id: "L1",
  product_id: "P1",
  product_name: "Cà phê sữa",
  variant_id: "V1",
  size_name: "M",
  unit_price: 20000,
  modifiers: [],
  qty: 1,
  discount_amount: 0,
  discount_type: "VND",
};

const CART_ITEM_2 = {
  id: "L2",
  product_id: "P2",
  product_name: "Trà đào cam sả",
  variant_id: "V2",
  size_name: "L",
  unit_price: 35000,
  modifiers: [],
  qty: 1,
  discount_amount: 0,
  discount_type: "VND",
};

describe("Bug C7: loadDraft cart preservation and save failure handling", () => {
  it("does not load the chosen draft and displays error toast when saving the current cart fails", async () => {
    const draftsList = [
      makeDraftRow("D1", "Đơn một", [CART_ITEM_1]),
      makeDraftRow("D2", "Đơn hai", [CART_ITEM_2]),
    ];
    (getPOSDrafts as any).mockResolvedValue(draftsList);

    await renderTracked(
      <POSScreen
        brandId="BRAND1"
        outletId="OUT-001"
        categories={[CATEGORY]}
        products={[]}
        variants={[]}
        modifiers={[]}
      />,
    );

    // 1. Load Draft 1 so the cart has CART_ITEM_1 ("Cà phê sữa")
    await openDraftsModal();
    const card1 = draftCard("Đơn một");
    await clickButtonInCard(card1, "Nạp");

    expect(document.body.textContent).toContain("Cà phê sữa");

    // 2. Open drafts modal again to load Draft 2
    await openDraftsModal();
    const card2 = draftCard("Đơn hai");

    // 3. Mock savePOSDraft to fail
    (savePOSDraft as any).mockResolvedValueOnce({
      success: false,
      error: "Không thể ghi cơ sở dữ liệu",
    });

    await clickButtonInCard(card2, "Nạp");
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // 4. Verify save of current cart was attempted
    expect(savePOSDraft).toHaveBeenCalled();

    // 5. Verify error toast is displayed
    expect(document.body.textContent).toContain("Không lưu được giỏ hiện tại, chưa mở đơn nháp");

    // 6. Verify chosen draft was NOT loaded into cart (cart still has Cà phê sữa, not Trà đào)
    expect(document.body.textContent).toContain("Cà phê sữa");
    const cartHeaders = Array.from(document.querySelectorAll("h4")).map(h => h.textContent);
    expect(cartHeaders).not.toContain("Trà đào cam sả");

    // 7. Verify modal remains open so user does not lose context
    expect(document.body.textContent).toContain("Danh sách đơn nháp");
  });

  it("awaits saving the current cart before loading the new draft when save succeeds", async () => {
    const draftsList = [
      makeDraftRow("D1", "Đơn một", [CART_ITEM_1]),
      makeDraftRow("D2", "Đơn hai", [CART_ITEM_2]),
    ];
    (getPOSDrafts as any).mockResolvedValue(draftsList);

    let resolveSave: ((val: any) => void) | null = null;
    const savePromise = new Promise(resolve => {
      resolveSave = resolve;
    });

    await renderTracked(
      <POSScreen
        brandId="BRAND1"
        outletId="OUT-001"
        categories={[CATEGORY]}
        products={[]}
        variants={[]}
        modifiers={[]}
      />,
    );

    // 1. Load Draft 1
    await openDraftsModal();
    await clickButtonInCard(draftCard("Đơn một"), "Nạp");
    expect(document.body.textContent).toContain("Cà phê sữa");

    // 2. Prepare slow save for next draft load
    (savePOSDraft as any).mockImplementationOnce(() => savePromise);

    // 3. Open drafts modal and attempt loading Draft 2
    await openDraftsModal();
    await clickButtonInCard(draftCard("Đơn hai"), "Nạp");

    // While save is in flight, Draft 2 must NOT be loaded yet
    const headersWhileSaving = Array.from(document.querySelectorAll("h4")).map(h => h.textContent);
    expect(headersWhileSaving).not.toContain("Trà đào cam sả");

    // 4. Resolve the save
    await act(async () => {
      resolveSave!({ success: true, draft: { id: "D_NEW", name: "Đơn lưu mới" } });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // 5. Now Draft 2 is loaded
    expect(document.body.textContent).toContain("Trà đào cam sả");
    expect(document.body.textContent).not.toContain("Danh sách đơn nháp");
  });
});
