// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ModifierForm } from "./ModifierForm";

const { push, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  return {
    push: pushFn,
    router: { push: pushFn, refresh: vi.fn() },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/app/admin/products/modifiers/actions", () => ({
  saveModifierAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModifierForm", () => {
  it("renders the modifier name field immediately on the page, not in a dialog", () => {
    render(<ModifierForm returnTo="/admin/products/modifiers" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Tên Tùy Chọn")).toBeInTheDocument();
  });

  it("defaults group_name to 'Thêm Topping'", () => {
    render(<ModifierForm returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm Tùy Chọn") as HTMLSelectElement;
    expect(groupSelect.value).toBe("Thêm Topping");
  });

  it("'Bỏ' navigates to returnTo without submitting", () => {
    render(
      <ModifierForm returnTo="/admin/products/modifiers?q=thach" />
    );
    const cancelButton = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/modifiers?q=thach");
  });
});
