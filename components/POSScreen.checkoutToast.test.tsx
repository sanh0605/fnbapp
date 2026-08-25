// @vitest-environment jsdom
//
// Render test for docs/superpowers/plans/2026-08-25-pos-success-message.md.
// Owner instruction (recorded in
// docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 1):
// "khi nhan vien bam tao don thanh cong se khong thong bao ma don ma chi
// thong bao thanh cong." Follows the createRoot + act pattern from
// components/POSScreen.itemModal.test.tsx. Per OPEN-ITEMS 46, submitOrderV2
// is a plain mocked function call (not a <form action> submit), so driving
// the real "TIEN MAT" button through the DOM and awaiting its resolution
// works under vitest.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import POSScreen from "./POSScreen";

const mocks = vi.hoisted(() => ({
  submitOrderV2: vi.fn(),
  enqueuePendingOrder: vi.fn(),
}));

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: mocks.submitOrderV2,
  getPOSDrafts: vi.fn(async () => []),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(),
  reportPosSyncFailure: vi.fn(),
}));

vi.mock("@/lib/pos-offline-queue", () => ({
  enqueuePendingOrder: mocks.enqueuePendingOrder,
  incrementAttemptCount: vi.fn(),
  listPendingOrders: vi.fn(async () => []),
  removePendingOrder: vi.fn(),
}));

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
  vi.clearAllMocks();
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

async function clickButtonWithText(text: string) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.trim().includes(text),
  );
  if (!btn) throw new Error(`button not found: "${text}"`);
  await fireClick(btn);
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

function toastMessages(): string[] {
  const region = document.querySelector('[aria-label="Thông báo"]');
  if (!region) return [];
  return Array.from(region.querySelectorAll("p")).map(p => p.textContent || "");
}

// Awaits the microtask queue so the mocked promise's .then chain (inside
// handleConfirmCheckout) resolves and the resulting setState is flushed.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const CATEGORY = { id: "CAT1", name: "Cà phê" };
const PRODUCT = { id: "P1", name: "Cà phê đen", category_id: CATEGORY.id };
const VARIANTS = [{ id: "V1", product_id: "P1", size_name: "M", price: 20000 }];

async function addOneItemToCart() {
  await renderTracked(
    <POSScreen
      categories={[CATEGORY]}
      products={[PRODUCT]}
      variants={VARIANTS}
      modifiers={[]}
      bestSellers={[PRODUCT.id]}
    />,
  );
  await openProductByName(PRODUCT.name);
  await fireClick(addToCartButton());
}

describe("POSScreen checkout success toast", () => {
  it("announces success without the order code", async () => {
    mocks.submitOrderV2.mockResolvedValue({
      success: true,
      order_id: "ord-1",
      order_no: "260825001001",
    });

    await addOneItemToCart();
    await clickButtonWithText("TIỀN MẶT");
    await flush();

    const messages = toastMessages();
    expect(messages.some(m => m.includes("Thanh toán thành công"))).toBe(true);
    expect(messages.some(m => m.includes("260825001001"))).toBe(false);
    expect(messages.some(m => m.includes("Mã đơn"))).toBe(false);
  });

  it("leaves the offline-queued toast's own wording untouched", async () => {
    // submitOrderV2 rejects (network failure) -- handleConfirmCheckout's
    // catch block queues the order instead, a different message entirely.
    // Covered in the same file so a future edit cannot quietly collapse the
    // two messages into one, per the plan's own instruction.
    mocks.submitOrderV2.mockRejectedValue(new Error("network unreachable"));
    mocks.enqueuePendingOrder.mockResolvedValue(undefined);

    await addOneItemToCart();
    await clickButtonWithText("TIỀN MẶT");
    await flush();

    const messages = toastMessages();
    expect(messages).toContain("Đã lưu đơn hàng, sẽ gửi khi có mạng trở lại.");
    expect(messages.some(m => m.includes("Thanh toán thành công"))).toBe(false);
  });
});
