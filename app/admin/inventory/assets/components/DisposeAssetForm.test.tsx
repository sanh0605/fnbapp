// @vitest-environment jsdom
//
// docs/superpowers/plans/2026-08-27-asset-acquired-date-off-by-one.md
// section 7 (OPEN-ITEMS 64): the default disposal date is
// `new Date().toISOString().slice(0, 10)` -- the browser's UTC calendar
// day, sliced before any Saigon conversion. A disposal recorded between
// 00:00 and 07:00 Saigon defaults to the PREVIOUS day, silently, with no
// error and nothing on screen to suggest it. Render-tested (OPEN-ITEMS 38)
// rather than asserted from source, since the defect is what a user
// actually sees pre-filled in the date field.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { DisposeAssetForm } from "./DisposeAssetForm";

const mocks = vi.hoisted(() => ({
  disposeAsset: vi.fn(),
  previewDisposalCharge: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("../actions", () => ({
  disposeAsset: mocks.disposeAsset,
  previewDisposalCharge: mocks.previewDisposalCharge,
}));
// docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
// section B: this component now calls useRouter().refresh() on save.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
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

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

const ASSET = {
  id: "TS-100",
  name: "Cây rửa ly",
  quantity: 5,
  remainingQuantity: 5,
  acquiredDate: "2026-06-01",
  unitCost: 10000,
  totalCost: 50000,
  termMonths: 12,
  remainingValue: 40000,
  bucket: "IN_USE" as const,
};

describe("DisposeAssetForm -- default disposal date", () => {
  it("defaults to today's Saigon date, not the UTC date, just after Saigon midnight", async () => {
    // Fake only Date -- setTimeout must stay real, since flush() below
    // relies on a genuine macrotask to let ModalPortal's effect mount.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-31T17:30:00.000Z")); // 2026-06-01T00:30 Saigon
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 0 });

    const container = await renderTracked(<DisposeAssetForm asset={ASSET} />);
    const trigger = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "Đánh dấu hỏng / thanh lý",
    )!;
    await fireClick(trigger);
    await flush();

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-06-01");
  });
});
