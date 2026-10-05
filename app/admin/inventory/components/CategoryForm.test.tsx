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

  it("Bỏ navigates to returnTo without saving", () => {
    render(<CategoryForm returnTo="/admin/inventory/categories" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/categories");
  });
});
