// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { CategoryForm, shouldConfirmAffectsPnlChange } from "./CategoryForm";
import type { DBCashCategory } from "@/types/db";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("../actions", () => ({
  addCashCategory: vi.fn().mockResolvedValue({}),
  updateCashCategory: vi.fn().mockResolvedValue({}),
  setCashCategoryStatus: vi.fn(),
  deleteCashCategory: vi.fn(),
}));
vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.clearAllMocks();
});

const CATEGORY: DBCashCategory = {
  id: "CFC-001",
  name: "Vận hành",
  kind: "EXPENSE",
  affects_pnl: true,
  status: "ACTIVE",
} as DBCashCategory;

describe("CategoryForm on-page behaviour", () => {
  it("renders the fields on the page without opening a dialog", () => {
    render(<CategoryForm returnTo="/admin/finance/categories" />);
    expect(screen.getByLabelText("Tên nhóm")).toBeInTheDocument();
  });

  it("Bỏ navigates to returnTo without saving", () => {
    render(<CategoryForm returnTo="/admin/finance/categories" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/finance/categories");
  });
});

// I3 -- owner decision 2026-09-11 ("Khoá, tạo nhóm mới"): a category that
// already has entries can no longer change its Thu/Chi side; the select
// must show as locked, not just be blocked server-side with no explanation.
describe("CategoryForm kind lock (I3)", () => {
  it("leaves the Thu/Chi select enabled when the category has no entries", () => {
    render(<CategoryForm category={CATEGORY} hasEntries={false} />);

    const select = document.querySelector('select[name="kind"]') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(screen.queryByText("Đã có dòng sổ — không đổi được bên")).toBeNull();
  });

  it("disables the Thu/Chi select and shows the hint when the category has entries", () => {
    render(<CategoryForm category={CATEGORY} hasEntries={true} />);

    const select = document.querySelector('select[disabled]') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(screen.getByText("Đã có dòng sổ — không đổi được bên")).toBeTruthy();
  });

  it("carries the category's real kind via a hidden input when locked, so the value still reaches the server", () => {
    render(<CategoryForm category={CATEGORY} hasEntries={true} />);

    const hidden = document.querySelector('input[type="hidden"][name="kind"]') as HTMLInputElement;
    expect(hidden.value).toBe("EXPENSE");
    // The visible select must not also post a "kind" field once locked, or
    // FormData would carry two values for the same key.
    const visibleSelect = document.querySelector('select[name="kind"]');
    expect(visibleSelect).toBeNull();
  });

  it("defaults to unlocked (no hasEntries prop) for a brand-new add form", () => {
    render(<CategoryForm />);

    const select = document.querySelector('select[name="kind"]') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });
});

// I3 -- affects_pnl stays editable even with entries present, but changing it
// on an existing category rewrites every past total, so it needs an in-page
// confirm step (lib/shared/dialog, not window.confirm) before saving.
//
// The actual save button posts through <form action={handleSubmit}>, a
// function-valued form action -- a React 19 / Next.js canary-channel
// feature this repo's installed react-dom (18.3.1) does not execute, so a
// simulated click-to-submit never reaches handleSubmit under jsdom+Vitest
// (verified: no existing form test in this repo submits and asserts on the
// mocked action either). The gating decision is exported as a pure
// function instead and unit-tested directly; production wiring calls it
// from inside handleSubmit before invoking updateCashCategory.
describe("shouldConfirmAffectsPnlChange (I3)", () => {
  it("requires confirmation when locked (has entries) and the value changed", () => {
    expect(shouldConfirmAffectsPnlChange(true, true, false)).toBe(true);
    expect(shouldConfirmAffectsPnlChange(true, false, true)).toBe(true);
  });

  it("does not require confirmation when the value is unchanged", () => {
    expect(shouldConfirmAffectsPnlChange(true, true, true)).toBe(false);
    expect(shouldConfirmAffectsPnlChange(true, false, false)).toBe(false);
  });

  it("does not require confirmation when the category has no entries, even if the value changed", () => {
    expect(shouldConfirmAffectsPnlChange(false, true, false)).toBe(false);
  });
});

const MANUAL_REVENUE: DBCashCategory = {
  id: "CFC-006",
  name: "Doanh thu ghi tay",
  kind: "INCOME",
  affects_pnl: true,
  is_sales_revenue: true,
  status: "ACTIVE",
} as DBCashCategory;

describe("CategoryForm sales-revenue box (BR-CASH-006)", () => {
  function open(ui: React.ReactElement) {
    render(ui);
  }

  it("shows the box, ticked, on an income category already marked", () => {
    open(<CategoryForm category={MANUAL_REVENUE} hasEntries />);
    expect((screen.getByLabelText("Tính là doanh thu bán hàng") as HTMLInputElement).checked).toBe(true);
  });

  it("hides the box on an expense category", () => {
    open(<CategoryForm category={CATEGORY} />);
    expect(screen.queryByLabelText("Tính là doanh thu bán hàng")).toBeNull();
  });

  it("shows the box on a new form once Thu is chosen", () => {
    open(<CategoryForm />);
    expect(screen.queryByLabelText("Tính là doanh thu bán hàng")).toBeNull();
    fireEvent.change(screen.getByLabelText("Bên"), { target: { value: "INCOME" } });
    expect(screen.getByLabelText("Tính là doanh thu bán hàng")).toBeTruthy();
  });

  it("clears the box when 'Tính vào lãi lỗ' is unticked, and does not re-tick it", () => {
    open(<CategoryForm category={MANUAL_REVENUE} hasEntries />);
    fireEvent.click(screen.getByLabelText("Tính vào lãi lỗ"));
    expect(screen.queryByLabelText("Tính là doanh thu bán hàng")).toBeNull();
    fireEvent.click(screen.getByLabelText("Tính vào lãi lỗ"));
    expect((screen.getByLabelText("Tính là doanh thu bán hàng") as HTMLInputElement).checked).toBe(false);
  });
});

