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
    expect(screen.getByLabelText(/^Tên tuỳ chọn/)).toBeInTheDocument();
  });

  it("defaults group_name to 'Thêm Topping'", () => {
    render(<ModifierForm returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm tuỳ chọn") as HTMLSelectElement;
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

// Wave K4 (BR-UI-008, BR-CASH-005, BR-UI-009): the option's price is the shared
// whole-đồng number box; 0đ is a real price ("Chọn Đá") and must show as 0.
describe("ModifierForm -- price box (wave K4)", () => {
  const priceBox = () => screen.getByLabelText("Giá thêm") as HTMLInputElement;

  it("is a text box that groups thousands as typed, with đ inside", () => {
    render(<ModifierForm returnTo="/admin/products/modifiers" />);
    const box = priceBox();
    expect(box.type).toBe("text");
    expect(box.getAttribute("inputmode")).toBe("numeric");
    expect(box.getAttribute("placeholder")).toBe("Ví dụ: 5,000");
    fireEvent.change(box, { target: { value: "5000" } });
    expect(box.value).toBe("5,000");
    expect(box.parentElement?.textContent).toContain("đ");
  });

  it("a new option starts empty and must be filled", () => {
    render(<ModifierForm returnTo="/admin/products/modifiers" />);
    expect(priceBox().value).toBe("");
    expect(priceBox().required).toBe(true);
  });

  it("an option priced 0đ shows 0, not an empty box", () => {
    render(
      <ModifierForm
        initialData={{ id: "MOD-001", name: "Ít đá", group_name: "Chọn Đá", price: 0 } as any}
        returnTo="/admin/products/modifiers"
      />,
    );
    expect(priceBox().value).toBe("0");
  });
});

describe("ModifierForm -- option groups come from a table the owner edits (audit F5)", () => {
  it.todo(
    "Ô Nhóm tuỳ chọn lấy từ trang riêng Nhóm tuỳ chọn chủ quán tự thêm, sửa, ngừng và xếp thứ tự hiện trên máy bán (chủ quán chốt 14/10/2026)",
  );
});
