// @vitest-environment jsdom
//
// Characterisation tests for the drafts modal inside components/POSScreen.tsx
// (JSX at lines 1104-1171, opened from the "Nháp" button at line 998, backed
// by refreshDrafts/saveDraft/loadDraft/deleteDraft and the three drafts
// state vars). Plan F, task F3a
// (docs/superpowers/plans/2026-08-11-split-pos-screen.md).
//
// Same rendering pattern as POSScreen.itemModal.test.tsx: the modal has no
// standalone export, reachable only by rendering the real POSScreen and
// clicking the "Nháp" button. Every test here drives it through the DOM.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import POSScreen from "./POSScreen";
import { formatNumber } from "@/lib/format";

// Same two mocks as POSScreen.itemModal.test.tsx, for the same reasons: a
// "use server" module and a real-IndexedDB module POSScreen touches on every
// render regardless of what a given test exercises. getPOSDrafts and
// deletePOSDraft are the two this file actually drives -- their resolved
// values are set per test below.
vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn(async () => []),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(async () => ({ success: true })),
  reportPosSyncFailure: vi.fn(),
}));

vi.mock("@/lib/pos-offline-queue", () => ({
  enqueuePendingOrder: vi.fn(),
  incrementAttemptCount: vi.fn(),
  listPendingOrders: vi.fn(async () => []),
  removePendingOrder: vi.fn(),
}));

import { getPOSDrafts, deletePOSDraft } from "@/app/pos/actions";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  (getPOSDrafts as any).mockResolvedValue([]);
  (deletePOSDraft as any).mockResolvedValue({ success: true });
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
  // refreshDrafts() fires in a useEffect on mount and awaits getPOSDrafts()
  // before calling setDrafts -- the render above only flushes the
  // synchronous commit, not that follow-up microtask chain. Flush it before
  // returning, or every test below would query the DOM before drafts land.
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
}

function draftCard(name: string): HTMLElement {
  const nameEl = Array.from(document.querySelectorAll("p")).find(
    p => p.textContent === name,
  );
  if (!nameEl) throw new Error(`draft card not found: "${name}"`);
  // p (name) -> "min-w-0 flex-1" wrapper -> row div (name block + action block)
  return nameEl.parentElement!.parentElement as HTMLElement;
}

function clickButtonInCard(card: HTMLElement, text: string) {
  const btn = Array.from(card.querySelectorAll("button")).find(
    b => b.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`"${text}" button not found in card`);
  return fireClick(btn);
}

// --- Fixtures -----------------------------------------------------------

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

// A simple one-line cart: no modifiers, qty 1, no discount.
const SIMPLE_LINE = {
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

// A line with modifiers, qty above one, and a PERCENT discount -- exercises
// every branch of the total formula in one draft.
const COMPLEX_LINE = {
  id: "L2",
  product_id: "P2",
  product_name: "Trà sữa",
  variant_id: "V2",
  size_name: "L",
  unit_price: 25000,
  modifiers: [{ id: "M1", name: "Trân châu", price: 5000 }, { id: "M2", name: "Thạch", price: 3000 }],
  qty: 3,
  discount_amount: 10,
  discount_type: "PERCENT",
};

// --- Tests ----------------------------------------------------------------

describe("POSScreen drafts modal", () => {
  it("shows the empty state text when there are no drafts", async () => {
    (getPOSDrafts as any).mockResolvedValue([]);

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

    await openDraftsModal();
    expect(document.body.textContent).toContain("Chưa có đơn nháp nào.");
  });

  it("a draft card shows its name, item count, and total", async () => {
    (getPOSDrafts as any).mockResolvedValue([
      makeDraftRow("D1", "Draft One", [SIMPLE_LINE]),
    ]);

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

    await openDraftsModal();
    const card = draftCard("Draft One");
    // 1 món • <total>
    expect(card.textContent).toContain("1 món");
    expect(card.textContent).toContain(formatNumber(20000));
  });

  it("a draft with modifiers, qty above one, and a PERCENT discount computes one exact total", async () => {
    (getPOSDrafts as any).mockResolvedValue([
      makeDraftRow("D2", "Draft Two", [COMPLEX_LINE]),
    ]);

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

    await openDraftsModal();
    const card = draftCard("Draft Two");
    // mods = 5000 + 3000 = 8000; base = (25000 + 8000) * 3 = 99000
    // discount = 99000 * 10% = 9900; total = 99000 - 9900 = 89100
    expect(card.textContent).toContain("3 món");
    expect(card.textContent).toContain(formatNumber(89100));
  });

  it('"Nạp" loads the draft into the cart and closes the modal', async () => {
    (getPOSDrafts as any).mockResolvedValue([
      makeDraftRow("D1", "Draft One", [SIMPLE_LINE]),
    ]);

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

    await openDraftsModal();
    const card = draftCard("Draft One");
    await clickButtonInCard(card, "Nạp");

    // Modal closed.
    expect(document.body.textContent).not.toContain("Danh sách đơn nháp");
    // Cart now holds the draft's line -- CartItemRow renders product_name
    // in an <h4>.
    const cartLine = Array.from(document.querySelectorAll("h4")).find(
      h => h.textContent === "Cà phê sữa",
    );
    expect(cartLine).toBeDefined();
  });

  it('"Xóa" calls deletePOSDraft with the draft id and removes the card once the refresh completes', async () => {
    // Default covers both the mount-time refreshDrafts() and the one the
    // "Nháp" button itself fires on click (components/POSScreen.tsx:993) --
    // both need the draft to still be there. Queued after it, the ONE call
    // that follows a successful delete (refreshDrafts() inside
    // deleteDraft's .then) gets the now-empty list.
    (getPOSDrafts as any).mockResolvedValue([makeDraftRow("D1", "Draft One", [SIMPLE_LINE])]);
    (deletePOSDraft as any).mockResolvedValue({ success: true });

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

    await openDraftsModal();
    const card = draftCard("Draft One");

    (getPOSDrafts as any).mockResolvedValueOnce([]);
    await clickButtonInCard(card, "Xóa");
    // deletePOSDraft().then(...) -> refreshDrafts() -- let that chain settle.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(deletePOSDraft).toHaveBeenCalledWith("D1");
    expect(document.body.textContent).not.toContain("Draft One");
    expect(document.body.textContent).toContain("Chưa có đơn nháp nào.");
  });
});
