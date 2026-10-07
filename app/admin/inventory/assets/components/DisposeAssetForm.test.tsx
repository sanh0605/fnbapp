// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { DisposeAssetForm } from "./DisposeAssetForm";
import type { AssetLotView } from "@/lib/assets/asset-items";

const mocks = vi.hoisted(() => ({
  disposeAsset: vi.fn(),
  previewDisposalCharge: vi.fn(),
  routerRefresh: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("../actions", () => ({
  disposeAsset: mocks.disposeAsset,
  previewDisposalCharge: mocks.previewDisposalCharge,
}));

vi.mock("@/app/admin/inventory/assets/actions", () => ({
  disposeAsset: mocks.disposeAsset,
  previewDisposalCharge: mocks.previewDisposalCharge,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.routerPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/assets/SPM-COC/dispose",
  redirect: vi.fn(),
  notFound: vi.fn(),
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
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// Real figures from the plan: Cốc đong 100ml remaining lots TS-030 and TS-057
const TS030_LOT: AssetLotView = {
  id: "TS-030",
  name: "Cốc đong 100ml",
  nameSnapshot: "Cốc đong 100ml",
  purchaseOrderId: "PO-003",
  acquiredDate: "2026-04-08",
  unitCost: 17500,
  totalCost: 35000,
  quantity: 2,
  remainingQuantity: 2,
  termMonths: 12,
  remainingValue: 20000,
  bucket: "IN_USE",
};

const TS057_LOT: AssetLotView = {
  id: "TS-057",
  name: "Cốc đong 100ml",
  nameSnapshot: "Cốc đong 100ml",
  purchaseOrderId: "PO-007",
  acquiredDate: "2026-07-01",
  unitCost: 13785,
  totalCost: 55140,
  quantity: 4,
  remainingQuantity: 4,
  termMonths: 12,
  remainingValue: 45000,
  bucket: "IN_USE",
};

// Single lot: Bình bơm TS-004
const TS004_LOT: AssetLotView = {
  id: "TS-004",
  name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
  nameSnapshot: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
  purchaseOrderId: "PO-009",
  acquiredDate: "2026-04-04",
  unitCost: 205920,
  totalCost: 411840,
  quantity: 2,
  remainingQuantity: 1,
  termMonths: 24,
  remainingValue: 145860,
  bucket: "IN_USE",
};

describe("DisposeAssetForm -- default disposal date", () => {
  it("defaults to today's Saigon date, not the UTC date, just after Saigon midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-31T17:30:00.000Z")); // 2026-06-01T00:30 Saigon
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 0 });

    await renderTracked(
      <DisposeAssetForm
        lots={[TS030_LOT, TS057_LOT]}
        initialLotId="TS-030"
        returnTo="/admin/inventory/assets/SPM-COC"
      />,
    );
    await flush();

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-06-01");
  });
});

describe("DisposeAssetForm -- lot picker and disposal", () => {
  it("renders radio list of lots with stock and preselects initialLotId", async () => {
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 0 });
    const container = await renderTracked(
      <DisposeAssetForm
        lots={[TS030_LOT, TS057_LOT]}
        initialLotId="TS-030"
        returnTo="/admin/inventory/assets/SPM-COC"
      />,
    );
    await flush();

    const radios = container.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
    expect(radios.length).toBe(2);

    const radio030 = Array.from(radios).find((r) => r.value === "TS-030");
    const radio057 = Array.from(radios).find((r) => r.value === "TS-057");
    expect(radio030).toBeDefined();
    expect(radio057).toBeDefined();
    expect(radio030!.checked).toBe(true);
    expect(radio057!.checked).toBe(false);

    // Each lot reads "Mua dd/mm/yyyy · giá một cái …đ · còn N"
    expect(container.textContent).toContain("Mua 08/04/2026 · giá một cái 17,500đ · còn 2");
    expect(container.textContent).toContain("Mua 01/07/2026 · giá một cái 13,785đ · còn 4");
  });

  it("does not render a radio picker when there is only a single lot", async () => {
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 171600 });
    const container = await renderTracked(
      <DisposeAssetForm
        lots={[TS004_LOT]}
        initialLotId="TS-004"
        returnTo="/admin/inventory/assets/SPM-BINH"
      />,
    );
    await flush();

    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(0);
    expect(container.textContent).toContain("Mua 04/04/2026");
    expect(container.textContent).toContain("còn 1");
  });

  it("calls previewDisposalCharge on mount with initialLotId", async () => {
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 171600 });
    await renderTracked(
      <DisposeAssetForm
        lots={[TS030_LOT, TS057_LOT]}
        initialLotId="TS-030"
        returnTo="/admin/inventory/assets/SPM-COC"
      />,
    );
    await flush();

    expect(mocks.previewDisposalCharge).toHaveBeenCalledTimes(1);
    expect(mocks.previewDisposalCharge).toHaveBeenCalledWith("TS-030", 1, expect.any(String));
  });

  it("changing the selected lot re-calls previewDisposalCharge with the new lot id", async () => {
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 0 });
    const container = await renderTracked(
      <DisposeAssetForm
        lots={[TS030_LOT, TS057_LOT]}
        initialLotId="TS-030"
        returnTo="/admin/inventory/assets/SPM-COC"
      />,
    );
    await flush();

    const radio057 = Array.from(
      container.querySelectorAll('input[type="radio"]'),
    ).find((r: any) => r.value === "TS-057")!;
    await fireClick(radio057);
    await flush();

    expect(mocks.previewDisposalCharge).toHaveBeenCalledWith("TS-057", 1, expect.any(String));
  });

  it("submit sends asset_id = the chosen lot", async () => {
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 0 });
    mocks.disposeAsset.mockResolvedValue({ ok: true });

    const container = await renderTracked(
      <DisposeAssetForm
        lots={[TS030_LOT, TS057_LOT]}
        initialLotId="TS-030"
        returnTo="/admin/inventory/assets/SPM-COC"
      />,
    );
    await flush();

    // Select TS-057 before submitting
    const radio057 = Array.from(
      container.querySelectorAll('input[type="radio"]'),
    ).find((r: any) => r.value === "TS-057")!;
    await fireClick(radio057);
    await flush();

    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(mocks.disposeAsset).toHaveBeenCalled();
    const formData = mocks.disposeAsset.mock.calls[0][0] as FormData;
    expect(formData.get("asset_id")).toBe("TS-057");
  });

  it("navigates to returnTo when 'Bỏ' is clicked", async () => {
    mocks.previewDisposalCharge.mockResolvedValue({ charge: 0 });
    const container = await renderTracked(
      <DisposeAssetForm
        lots={[TS030_LOT, TS057_LOT]}
        initialLotId="TS-030"
        returnTo="/admin/inventory/assets/SPM-COC"
      />,
    );
    await flush();

    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Bỏ",
    )!;
    expect(cancelButton).toBeDefined();
    await fireClick(cancelButton);

    expect(mocks.routerPush).toHaveBeenCalledWith("/admin/inventory/assets/SPM-COC");
  });
});
