// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryForm } from "./CategoryForm";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/app/admin/inventory/actions", () => ({
  addItemCategory: vi.fn().mockResolvedValue({}),
  updateItemCategory: vi.fn().mockResolvedValue({}),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.clearAllMocks();
});

describe("CategoryForm on-page behaviour", () => {
  it("renders on page and shows the category name field directly", () => {
    render(<CategoryForm returnTo="/admin/inventory/categories" />);
    expect(screen.getByLabelText(/Tên Phân Loại/i)).toBeInTheDocument();
  });

  // BR-UI-001: no English twin in brackets; spec 2.6: sentence case; spec 2.3:
  // the example sits under the box as a hint.
  it("labels are Vietnamese in sentence case, the example under the name box", () => {
    render(<CategoryForm returnTo="/admin/inventory/categories" />);
    expect(screen.queryByText(/System Type/)).toBeNull();
    expect(screen.getByLabelText(/^Đặc tính/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tên phân loại/)).toBeInTheDocument();
    expect(screen.getByText("Ví dụ: Nguyên liệu khô, Bao bì")).toBeInTheDocument();
  });

  it("Bỏ navigates to returnTo without saving", () => {
    render(<CategoryForm returnTo="/admin/inventory/categories" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/categories");
  });

  it("shows FormActionBar with 'Tạo' and 'Bỏ' in create mode", () => {
    render(<CategoryForm returnTo="/admin/inventory/categories" />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("shows FormActionBar with 'Lưu thay đổi' and 'Bỏ thay đổi' in edit mode", () => {
    render(<CategoryForm initialData={{ id: "CAT-1", name: "Nguyên liệu", system_type: "RAW" }} returnTo="/admin/inventory/categories" />);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/categories");
  });
});
