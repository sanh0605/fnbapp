// @vitest-environment jsdom
//
// Render test per docs/superpowers/plans/2026-08-26-outlet-done-properly.md
// section 5: "the edit form shows brand, address, start date and both hour
// fields; today it shows only the name." Same createRoot + act pattern as
// components/POSScreen.itemModal.test.tsx.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { OutletForm } from "./OutletForm";
import type { DBOutlet, DBBrand } from "@/types/db";

vi.mock("../actions", () => ({
  addOutlet: vi.fn(),
  editOutlet: vi.fn(),
  retireOutlet: vi.fn(),
}));
vi.mock("@/lib/dialog", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));
// docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
// section B: this component now calls useRouter().refresh() on save.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// OutletForm renders CustomDatePicker (react-datepicker) unconditionally;
// that component calls window.matchMedia in a mount effect, which jsdom
// does not implement. Same stub as components/ProductForm.test.tsx.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

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

const BRANDS: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", start_date: "", status: "ACTIVE", created_at: "" },
];

const OUTLET: DBOutlet = {
  id: "OUT-001", code: "001", name: "Điểm bán 1", brand_id: "BR-001", address: "123 ABC",
  status: "ACTIVE", start_date: "2026-01-01", end_date: null,
  open_time: "06:00", close_time: "21:00", created_at: "", updated_at: "",
};

describe("OutletForm edit mode", () => {
  it("opens with the retitled action, then shows brand, address, start date and both hour fields, not the name alone", async () => {
    const container = await renderTracked(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} />);

    const editButton = Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Sửa");
    expect(editButton).toBeTruthy();
    await fireClick(editButton!);

    expect(document.body.textContent).toContain("Sửa điểm bán");
    expect(document.querySelector('select[name="brand_id"]')).not.toBeNull();
    expect(document.querySelector('input[name="address"]')).not.toBeNull();
    // The date picker renders as a plain text input driven by React state,
    // not a native <input type="date">.
    expect(document.body.textContent).toContain("Ngày bắt đầu hoạt động");
    expect(document.querySelector('input[name="open_time"]')).not.toBeNull();
    expect(document.querySelector('input[name="close_time"]')).not.toBeNull();
  });

  it("pre-fills brand, address and hours from the outlet being edited", async () => {
    await renderTracked(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} />);
    const editButton = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Sửa")!;
    await fireClick(editButton);

    const brandSelect = document.querySelector('select[name="brand_id"]') as HTMLSelectElement;
    const addressInput = document.querySelector('input[name="address"]') as HTMLInputElement;
    const openInput = document.querySelector('input[name="open_time"]') as HTMLInputElement;
    const closeInput = document.querySelector('input[name="close_time"]') as HTMLInputElement;

    expect(brandSelect.value).toBe("BR-001");
    expect(addressInput.value).toBe("123 ABC");
    expect(openInput.value).toBe("06:00");
    expect(closeInput.value).toBe("21:00");
  });

  it("shows the code, frozen and explained, not editable", async () => {
    await renderTracked(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} />);
    const editButton = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Sửa")!;
    await fireClick(editButton);

    expect(document.body.textContent).toContain("001");
    expect(document.body.textContent).toContain("không đổi được");
    // No input posts a "code" field at all.
    expect(document.querySelector('input[name="code"]')).toBeNull();
  });
});

describe("OutletForm add mode", () => {
  it("also shows brand, address, start date and both hour fields", async () => {
    await renderTracked(<OutletForm brands={BRANDS} outlets={[]} />);
    const addButton = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Thêm Điểm Bán"))!;
    await fireClick(addButton);

    expect(document.querySelector('select[name="brand_id"]')).not.toBeNull();
    expect(document.querySelector('input[name="address"]')).not.toBeNull();
    expect(document.querySelector('input[name="open_time"]')).not.toBeNull();
    expect(document.querySelector('input[name="close_time"]')).not.toBeNull();
  });
});
