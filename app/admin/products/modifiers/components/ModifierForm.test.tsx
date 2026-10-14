// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ModifierForm } from "./ModifierForm";
import { saveModifierAction } from "@/app/admin/products/modifiers/actions";

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

const sampleGroups = [
  {
    id: "MG-001",
    name: "Thêm Topping",
    selection_mode: "MANY" as const,
    max_total: 3,
    allow_standalone: true,
    sort_order: 50,
    status: "ACTIVE" as const,
  },
  {
    id: "MG-002",
    name: "Mức đường",
    selection_mode: "ONE" as const,
    max_total: null,
    allow_standalone: false,
    sort_order: 10,
    status: "ACTIVE" as const,
  },
  {
    id: "MG-003",
    name: "Mức đá",
    selection_mode: "ONE" as const,
    max_total: null,
    allow_standalone: false,
    sort_order: 20,
    status: "ACTIVE" as const,
  },
];

describe("ModifierForm", () => {
  it("renders the modifier name field immediately on the page, not in a dialog", () => {
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText(/^Tên tuỳ chọn/)).toBeInTheDocument();
  });

  it("defaults group to the first group", () => {
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm tuỳ chọn") as HTMLSelectElement;
    expect(groupSelect.value).toBe("MG-001");
  });

  it("'Bỏ' navigates to returnTo without submitting", () => {
    render(
      <ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers?q=thach" />
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
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    const box = priceBox();
    expect(box.type).toBe("text");
    expect(box.getAttribute("inputmode")).toBe("numeric");
    expect(box.getAttribute("placeholder")).toBe("Ví dụ: 5,000");
    fireEvent.change(box, { target: { value: "5000" } });
    expect(box.value).toBe("5,000");
    expect(box.parentElement?.textContent).toContain("đ");
  });

  it("a new option starts empty and must be filled", () => {
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    expect(priceBox().value).toBe("");
    expect(priceBox().required).toBe(true);
  });

  it("an option priced 0đ shows 0, not an empty box", () => {
    render(
      <ModifierForm
        initialData={{ id: "MOD-001", name: "Ít đá", group_id: "MG-003", group_name: "Mức đá", price: 0 } as any}
        groups={sampleGroups}
        returnTo="/admin/products/modifiers"
      />,
    );
    expect(priceBox().value).toBe("0");
  });
});

describe("ModifierForm -- option groups come from a table the owner edits (audit F5)", () => {
  it("Ô Nhóm tuỳ chọn lấy từ trang riêng Nhóm tuỳ chọn chủ quán tự thêm, sửa, ngừng và xếp thứ tự hiện trên máy bán (chủ quán chốt 14/10/2026)", () => {
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm tuỳ chọn") as HTMLSelectElement;
    expect(groupSelect).toBeInTheDocument();

    // The options match sampleGroups exactly, not the 4 old hardcoded names
    expect(screen.getByRole("option", { name: "Thêm Topping" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mức đường" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mức đá" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Chọn Size" })).toBeNull();
  });

  it("on ModifierForm, 'Có sẵn' shows only for a Chọn một group", () => {
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm tuỳ chọn") as HTMLSelectElement;

    // Default is MG-001 (Thêm Topping, selection_mode = 'MANY')
    expect(screen.queryByLabelText(/Có sẵn/)).toBeNull();
    expect(screen.getByLabelText("Tối đa mỗi món")).toBeInTheDocument();

    // Switch to MG-002 (Mức đường, selection_mode = 'ONE')
    fireEvent.change(groupSelect, { target: { value: "MG-002" } });

    expect(screen.getByLabelText(/Có sẵn/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tối đa mỗi món")).toBeNull();
  });

  it("shows 'Bán độc lập' switch only when the group has allow_standalone in edit mode", () => {
    // Editing an option in MG-001 (allow_standalone: true)
    const { unmount } = render(
      <ModifierForm
        initialData={{ id: "MOD-001", name: "Trân châu trắng", group_id: "MG-001", group_name: "Thêm Topping", price: 5000 } as any}
        groups={sampleGroups}
        returnTo="/admin/products/modifiers"
      />
    );
    expect(screen.getByText("Bán độc lập")).toBeInTheDocument();

    // Editing an option in MG-002 (allow_standalone: false)
    unmount();
    render(
      <ModifierForm
        initialData={{ id: "MOD-002", name: "Ít đường", group_id: "MG-002", group_name: "Mức đường", price: 0 } as any}
        groups={sampleGroups}
        returnTo="/admin/products/modifiers"
      />
    );
    expect(screen.queryByText("Bán độc lập")).toBeNull();
  });

  it("sends is_default as 'on' when ticking 'Có sẵn' on a Chọn một group", async () => {
    vi.mocked(saveModifierAction).mockResolvedValue({ success: true } as any);
    render(<ModifierForm groups={sampleGroups} returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm tuỳ chọn") as HTMLSelectElement;
    fireEvent.change(groupSelect, { target: { value: "MG-002" } });

    const defaultCheckbox = screen.getByLabelText(/Có sẵn/);
    fireEvent.click(defaultCheckbox);
    expect((defaultCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.change(screen.getByLabelText(/^Tên tuỳ chọn/), { target: { value: "Bình thường" } });
    fireEvent.change(screen.getByLabelText("Giá thêm"), { target: { value: "0" } });

    fireEvent.click(screen.getByRole("button", { name: "Lưu tuỳ chọn" }));

    await waitFor(() => {
      expect(saveModifierAction).toHaveBeenCalled();
    });
    const fd = vi.mocked(saveModifierAction).mock.calls[0][0] as FormData;
    expect(fd.get("is_default")).toBe("on");
  });

  it("has an empty group Select when groups is empty, with no fallback option", () => {
    render(<ModifierForm groups={[]} returnTo="/admin/products/modifiers" />);
    const groupSelect = screen.getByLabelText("Nhóm tuỳ chọn") as HTMLSelectElement;
    expect(groupSelect.options.length).toBe(0);
    expect(screen.queryByRole("option", { name: "Thêm Topping" })).toBeNull();
  });
});
