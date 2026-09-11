// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryForm, shouldConfirmAffectsPnlChange } from "./CategoryForm";
import type { DBCashCategory } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../actions", () => ({
  addCashCategory: vi.fn().mockResolvedValue({}),
  updateCashCategory: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const CATEGORY: DBCashCategory = {
  id: "CFC-001",
  name: "Vận hành",
  kind: "EXPENSE",
  affects_pnl: true,
  status: "ACTIVE",
} as DBCashCategory;

// I3 -- owner decision 2026-09-11 ("Khoá, tạo nhóm mới"): a category that
// already has entries can no longer change its Thu/Chi side; the select
// must show as locked, not just be blocked server-side with no explanation.
describe("CategoryForm kind lock (I3)", () => {
  it("leaves the Thu/Chi select enabled when the category has no entries", () => {
    render(<CategoryForm category={CATEGORY} hasEntries={false} />);
    fireEvent.click(screen.getByText("Sửa"));

    const select = document.querySelector('select[name="kind"]') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(screen.queryByText("Đã có dòng sổ — không đổi được bên")).toBeNull();
  });

  it("disables the Thu/Chi select and shows the hint when the category has entries", () => {
    render(<CategoryForm category={CATEGORY} hasEntries={true} />);
    fireEvent.click(screen.getByText("Sửa"));

    const select = document.querySelector('select[disabled]') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(screen.getByText("Đã có dòng sổ — không đổi được bên")).toBeTruthy();
  });

  it("carries the category's real kind via a hidden input when locked, so the value still reaches the server", () => {
    render(<CategoryForm category={CATEGORY} hasEntries={true} />);
    fireEvent.click(screen.getByText("Sửa"));

    const hidden = document.querySelector('input[type="hidden"][name="kind"]') as HTMLInputElement;
    expect(hidden.value).toBe("EXPENSE");
    // The visible select must not also post a "kind" field once locked, or
    // FormData would carry two values for the same key.
    const visibleSelect = document.querySelector('select[name="kind"]');
    expect(visibleSelect).toBeNull();
  });

  it("defaults to unlocked (no hasEntries prop) for a brand-new add form", () => {
    render(<CategoryForm />);
    fireEvent.click(screen.getByText("+ Thêm nhóm"));

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
