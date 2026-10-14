// @vitest-environment jsdom
//
// Tests for Bug C2: orders waiting on tablet are only resent on browser "online" event.
// Fix:
// 1. Run syncPendingOrders every 60s while screen is open (clear interval on unmount),
//    and right after each successful checkout.
// 2. Guard against two syncs running at once (a ref flag).
// 3. Show badge in header with waiting orders count when above zero ("X đơn chờ gửi"),
//    fitted for phone header without wrapping.
// Uses fake timers.

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
  reportPosSyncFailure: vi.fn(),
}));

vi.mock("@/lib/pos/pos-offline-queue", () => ({
  enqueuePendingOrder: vi.fn(),
  incrementAttemptCount: vi.fn(),
  listPendingOrders: vi.fn(async () => []),
  removePendingOrder: vi.fn(async () => {}),
}));

import { submitOrderV2, getPOSDrafts } from "@/app/pos/actions";
import { listPendingOrders, removePendingOrder } from "@/lib/pos/pos-offline-queue";

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
  (listPendingOrders as any).mockResolvedValue([]);
  (submitOrderV2 as any).mockResolvedValue({ success: true });
  (removePendingOrder as any).mockResolvedValue(undefined);

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

async function fireClick(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function openProductByName(name: string) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.includes(name),
  );
  if (!btn) throw new Error(`product tile not found: "${name}"`);
  await fireClick(btn);
}

function addToCartButton(): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.startsWith("THÊM") || b.textContent?.startsWith("CẬP NHẬT"),
  );
  if (!btn) throw new Error("add/update button not found");
  return btn as HTMLButtonElement;
}

async function clickButtonWithText(text: string) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.trim().includes(text),
  );
  if (!btn) throw new Error(`button not found: "${text}"`);
  await fireClick(btn);
}

const CATEGORY = { id: "CAT1", name: "Cà phê" };
const PRODUCT = { id: "P1", name: "Cà phê đen", category_id: CATEGORY.id };
const VARIANTS = [{ id: "V1", product_id: "P1", size_name: "M", price: 20000 }];

function makePendingOrder(token: string) {
  return {
    requestToken: token,
    cartInput: {
      brand_id: "BRAND1",
      outlet_id: "OUT-001",
      items: [
        {
          product_id: "P1",
          variant_id: "V1",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 0, type: "VND" as const },
        },
      ],
      payment_method: "CASH" as const,
      actor: { id: "U1", name: "Thu" },
    },
    queuedAt: "2026-10-14T10:00:00Z",
    attemptCount: 1,
  };
}

describe("Bug C2: Offline pending orders sync, interval, lock, and header badge", () => {
  it("displays the pending orders badge in the header when pending count is above zero", async () => {
    const pendingOrders = [
      makePendingOrder("TOKEN-1"),
      makePendingOrder("TOKEN-2"),
      makePendingOrder("TOKEN-3"),
    ];
    // Keep them pending (e.g. submitOrderV2 throws or fails network) so they stay pending
    (listPendingOrders as any).mockResolvedValue(pendingOrders);
    (submitOrderV2 as any).mockRejectedValue(new Error("Network down"));

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

    // Header must show "3 đơn chờ gửi"
    const header = document.querySelector("header");
    expect(header).toBeDefined();
    expect(header?.textContent).toContain("3 đơn chờ gửi");
  });

  it("does not display the pending orders badge when there are zero pending orders", async () => {
    (listPendingOrders as any).mockResolvedValue([]);

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

    const header = document.querySelector("header");
    expect(header?.textContent).not.toContain("đơn chờ gửi");
  });

  it("periodically triggers syncPendingOrders every 60 seconds with fake timers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    (listPendingOrders as any).mockResolvedValue([]);
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

    // Initial mount sync completed
    (submitOrderV2 as any).mockClear();

    // Now a pending order arrives in queue
    const order = makePendingOrder("TOKEN-INTERVAL");
    (listPendingOrders as any).mockResolvedValue([order]);

    // Advance 59 seconds: sync must NOT have run yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59000);
    });
    expect(submitOrderV2).not.toHaveBeenCalled();

    // Advance 1 more second (total 60 seconds)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(submitOrderV2).toHaveBeenCalledWith(order.cartInput, order.requestToken);
  });

  it("clears the 60-second sync interval on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    (listPendingOrders as any).mockResolvedValue([]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <POSScreen
          brandId="BRAND1"
          outletId="OUT-001"
          categories={[CATEGORY]}
          products={[]}
          variants={[]}
          modifiers={[]}
        />,
      );
    });
    await flush();

    (submitOrderV2 as any).mockClear();

    // Unmount before interval fires
    await act(async () => {
      root.unmount();
    });
    const rootIdx = roots.indexOf(root);
    if (rootIdx !== -1) roots.splice(rootIdx, 1);
    const contIdx = containers.indexOf(container);
    if (contIdx !== -1) containers.splice(contIdx, 1);
    container.remove();

    const order = makePendingOrder("TOKEN-UNMOUNT");
    (listPendingOrders as any).mockResolvedValue([order]);

    // Advance timer by 120 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });

    expect(submitOrderV2).not.toHaveBeenCalled();
  });

  it("guards against two syncs running concurrently so the same order is not submitted twice", async () => {
    const order = makePendingOrder("TOKEN-CONCURRENT");
    (listPendingOrders as any).mockResolvedValue([order]);

    let resolveFirstSubmit: ((res: any) => void) | null = null;
    const slowSubmitPromise = new Promise(resolve => {
      resolveFirstSubmit = resolve;
    });

    // First call to submitOrderV2 hangs
    (submitOrderV2 as any).mockImplementationOnce(() => slowSubmitPromise);

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

    // First sync started on mount and is awaiting submitOrderV2
    expect(submitOrderV2).toHaveBeenCalledTimes(1);

    // Trigger second sync while first is in-flight via window 'online' event
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();

    // Guard must have blocked second sync from submitting the order again
    expect(submitOrderV2).toHaveBeenCalledTimes(1);

    // Complete the first sync
    (listPendingOrders as any).mockResolvedValue([]);
    await act(async () => {
      resolveFirstSubmit!({ success: true });
    });
    await flush();

    // Once finished, a subsequent trigger can run
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
  });

  it("triggers syncPendingOrders right after each successful checkout", async () => {
    (submitOrderV2 as any).mockResolvedValue({
      success: true,
      order_id: "ord-1",
      order_no: "260825001001",
    });
    (listPendingOrders as any).mockResolvedValue([]);

    await renderTracked(
      <POSScreen
        brandId="BRAND1"
        outletId="OUT-001"
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
        bestSellers={[PRODUCT.id]}
      />,
    );

    // Add one item to cart (same as POSScreen.checkoutToast.test.tsx)
    await openProductByName(PRODUCT.name);
    await fireClick(addToCartButton());
    expect(document.body.textContent).toContain("Cà phê đen");

    (submitOrderV2 as any).mockClear();
    (listPendingOrders as any).mockClear();

    const pendingOrder = makePendingOrder("TOKEN-AFTER-CHECKOUT");
    // After checkout submits, pending queue has an order to sync
    (listPendingOrders as any).mockResolvedValue([pendingOrder]);

    // Find and click "TIỀN MẶT" button in CartPanel to checkout
    await clickButtonWithText("TIỀN MẶT");
    await flush();

    // Verify submitOrderV2 was called for checkout AND then for the pending sync
    // 1st call: checkout of current cart
    // 2nd call: syncPendingOrders resending TOKEN-AFTER-CHECKOUT
    expect(submitOrderV2).toHaveBeenCalledTimes(2);
    expect(submitOrderV2).toHaveBeenLastCalledWith(pendingOrder.cartInput, pendingOrder.requestToken);
  });
});
