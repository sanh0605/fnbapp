// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { OutletForm } from "./OutletForm";
import type { DBOutlet, DBBrand } from "@/types/db";

const { replace, refresh, back, push, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    searchParams: new URLSearchParams(),
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

const mocks = vi.hoisted(() => ({
  addOutlet: vi.fn(),
  editOutlet: vi.fn(),
  retireOutlet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/outlets",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("@/app/admin/outlets/actions", () => ({
  addOutlet: mocks.addOutlet,
  editOutlet: mocks.editOutlet,
  retireOutlet: mocks.retireOutlet,
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
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

const BRANDS: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", start_date: "", status: "ACTIVE", created_at: "" },
];

const OUTLET: DBOutlet = {
  id: "OUT-001", code: "001", name: "Điểm bán 1", brand_id: "BR-001", address: "123 ABC",
  status: "ACTIVE", start_date: "2026-01-01", end_date: null,
  open_time: "06:00", close_time: "21:00", created_at: "", updated_at: "",
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
  mocks.addOutlet.mockReset();
  mocks.editOutlet.mockReset();
  mocks.retireOutlet.mockReset();
});

describe("OutletForm edit mode", () => {
  it("shows brand, address, start date and both hour fields, not the name alone", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector('select[name="brand_id"]')).not.toBeNull();
    expect(document.querySelector('input[name="address"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Ngày bắt đầu hoạt động");
    expect(document.querySelector('input[name="open_time"]')).not.toBeNull();
    expect(document.querySelector('input[name="close_time"]')).not.toBeNull();
  });

  it("pre-fills brand, address and hours from the outlet being edited", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);

    const brandSelect = document.querySelector('select[name="brand_id"]') as HTMLSelectElement;
    const addressInput = document.querySelector('input[name="address"]') as HTMLInputElement;
    const openInput = document.querySelector('input[name="open_time"]') as HTMLInputElement;
    const closeInput = document.querySelector('input[name="close_time"]') as HTMLInputElement;

    expect(brandSelect.value).toBe("BR-001");
    expect(addressInput.value).toBe("123 ABC");
    expect(openInput.value).toBe("06:00");
    expect(closeInput.value).toBe("21:00");
  });

  it("shows the code, frozen and explained, not editable", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);

    expect(document.body.textContent).toContain("001");
    expect(document.body.textContent).toContain("không đổi được");
    expect(document.querySelector('input[name="code"]')).toBeNull();
  });
});

describe("OutletForm add mode", () => {
  it("also shows brand, address, start date and both hour fields", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);

    expect(document.querySelector('select[name="brand_id"]')).not.toBeNull();
    expect(document.querySelector('input[name="address"]')).not.toBeNull();
    expect(document.querySelector('input[name="open_time"]')).not.toBeNull();
    expect(document.querySelector('input[name="close_time"]')).not.toBeNull();
  });

  it("shows the next auto-assigned code previewing nextOutletCode (004 for 001 and 003)", () => {
    const existingOutlets: DBOutlet[] = [
      { ...OUTLET, id: "OUT-001", code: "001" },
      { ...OUTLET, id: "OUT-003", code: "003" },
    ];
    render(<OutletForm brands={BRANDS} outlets={existingOutlets} returnTo="/admin/outlets" />);

    expect(document.body.textContent).toContain("004");
    expect(document.body.textContent).toContain("Mã điểm bán sẽ được gán tự động");
  });

  it("clicking Bỏ goes to returnTo without saving", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/outlets");
    expect(mocks.addOutlet).not.toHaveBeenCalled();
  });
});
