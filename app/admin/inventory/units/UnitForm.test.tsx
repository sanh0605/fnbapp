// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { UnitForm } from "./UnitForm";

const mocks = vi.hoisted(() => ({
  deleteUnit: vi.fn(),
  confirmDialog: vi.fn(),
  alertDialog: vi.fn(),
  routerRefresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/admin/inventory/actions", () => ({
  addUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: mocks.deleteUnit,
}));
vi.mock("@/lib/shared/dialog", () => ({
  confirm: mocks.confirmDialog,
  alert: mocks.alertDialog,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.push }),
}));

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (roots.length) {
    const root = roots.pop()!;
    act(() => root.unmount());
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

// Note: The DeleteBtn test suite ("the owner's Combo 2 case") was moved
// to UnitsClient.test.tsx via the DataList bin button per Wave 2 brief B §3.
describe("UnitForm on-page behaviour", () => {
  it("renders on page showing 'Tên đơn vị' and Bỏ navigates to returnTo without saving", async () => {
    const container = await renderTracked(<UnitForm returnTo="/admin/inventory/units" />);
    const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    const boBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Bỏ",
    )!;
    expect(boBtn).not.toBeUndefined();
    await fireClick(boBtn);
    expect(mocks.push).toHaveBeenCalledWith("/admin/inventory/units");
  });
});
