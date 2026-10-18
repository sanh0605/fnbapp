// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { ModifierDetailView, type LinkedProduct } from "./ModifierDetailView";
import type { DBModifier } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/products/modifiers/MOD-001",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const confirmMock = vi.fn();
vi.mock("@/lib/shared/dialog", () => ({
  confirm: (...args: any[]) => confirmMock(...args),
}));

const setModifierStatusMock = vi.fn();
const deleteModifierActionMock = vi.fn();
vi.mock("@/app/admin/products/modifiers/actions", () => ({
  deleteModifierAction: (...args: any[]) => deleteModifierActionMock(...args),
  setModifierStatus: (...args: any[]) => setModifierStatusMock(...args),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const linkedModifier: DBModifier = {
  id: "MOD-001",
  name: "Trân châu đen",
  price: "5000",
  status: "ACTIVE",
  product_id: "PROD-035",
  group_id: "MG-001",
  is_default: false,
  max_qty: null,
};

const linkedProduct: LinkedProduct = {
  id: "PROD-035",
  name: "Trân châu đen",
  status: "ACTIVE",
};

const unlinkedModifier: DBModifier = {
  id: "MOD-002",
  name: "Size L",
  price: "10000",
  status: "ACTIVE",
  product_id: null,
  group_id: "MG-001",
  is_default: false,
  max_qty: null,
};

describe("ModifierDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Món liên kết' link to /admin/products/PROD-035, 'Chỉnh sửa' link, and 'Xoá' button for linked modifier", () => {
    const returnTo = "/admin/products/modifiers";
    render(
      <ModifierDetailView
        modifier={linkedModifier}
        product={linkedProduct}
        groupName="Thêm Topping"
        allowStandalone={true}
        canDelete={true}
        returnTo={returnTo}
      />,
    );

    // Món liên kết link
    const allLinks = screen.getAllByRole("link");
    const prodLink = allLinks.find(
      (l) => l.getAttribute("href") === "/admin/products/PROD-035",
    );
    expect(prodLink).toBeDefined();
    expect(prodLink?.textContent).toBe("Trân châu đen");

    // Chỉnh sửa link
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink.getAttribute("href")).toContain(
      "/admin/products/modifiers/MOD-001/edit?returnTo=",
    );

    // Xoá button
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();

    // Bán độc lập plain text "Có" and price has "đ"
    expect(screen.getByText("Bán độc lập")).toBeInTheDocument();
    expect(screen.getByText("Có")).toBeInTheDocument();
    expect(screen.getByText("5,000đ")).toBeInTheDocument();
  });

  it("shows '—' for unlinked modifier", () => {
    const returnTo = "/admin/products/modifiers";
    render(
      <ModifierDetailView
        modifier={unlinkedModifier}
        product={null}
        groupName="Chọn Size"
        allowStandalone={false}
        canDelete={true}
        returnTo={returnTo}
      />,
    );

    const allLinks = screen.getAllByRole("link");
    const prodLink = allLinks.find((l) =>
      (l.getAttribute("href") ?? "").startsWith("/admin/products/PROD-"),
    );
    expect(prodLink).toBeUndefined();

    // Expect "—" to be present for Món liên kết
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    // Chỉnh sửa link
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink.getAttribute("href")).toContain(
      "/admin/products/modifiers/MOD-002/edit?returnTo=",
    );

    // Xoá button
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });

  it("uses groupName and displays 'Không' for Bán độc lập when no active product is linked", () => {
    render(
      <ModifierDetailView
        modifier={{
          id: "MOD-003",
          name: "Trân châu sợi",
          price: "6000",
          status: "ACTIVE",
          product_id: null,
          group_id: "MG-005",
          is_default: false,
          max_qty: null,
        } as DBModifier}
        product={null}
        groupName="Topping đặc biệt"
        allowStandalone={true}
        canDelete={false}
        returnTo="/admin/products/modifiers"
      />
    );

    // Displays groupName directly in "Nhóm" row
    expect(screen.getByText("Topping đặc biệt")).toBeInTheDocument();
    expect(screen.getByText("6,000đ")).toBeInTheDocument();
    const row = screen.getByText("Bán độc lập").closest<HTMLElement>("div.grid")!;
    expect(within(row).getByText("Không")).toBeInTheDocument();
  });

  it("shows 'Có sẵn' but not 'Tối đa mỗi món', and shows '—' for 'Bán độc lập' when group is Chọn một", () => {
    render(
      <ModifierDetailView
        modifier={{
          id: "MOD-004",
          name: "Ít đường",
          price: "0",
          status: "ACTIVE",
          product_id: null,
          group_id: "MG-002",
          is_default: true,
          max_qty: null,
        } as DBModifier}
        product={null}
        groupName="Mức đường"
        allowStandalone={true}
        groupSelectionMode="ONE"
        canDelete={false}
        returnTo="/admin/products/modifiers"
      />
    );

    // Có sẵn is "Có"
    expect(screen.getByText("Có sẵn")).toBeInTheDocument();
    expect(screen.getByText("Có")).toBeInTheDocument();

    expect(screen.queryByText("Tối đa mỗi món")).toBeNull();

    // Bán độc lập is "—"
    const row = screen.getByText("Bán độc lập").closest<HTMLElement>("div.grid")!;
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("shows numeric 'Tối đa mỗi món' when max_qty is set", () => {
    render(
      <ModifierDetailView
        modifier={{
          id: "MOD-005",
          name: "Trân châu đen",
          price: "5000",
          status: "ACTIVE",
          product_id: null,
          group_id: "MG-001",
          is_default: false,
          max_qty: 3,
        } as DBModifier}
        product={null}
        groupName="Thêm Topping"
        allowStandalone={true}
        groupSelectionMode="MANY"
        canDelete={false}
        returnTo="/admin/products/modifiers"
      />
    );

    expect(screen.queryByText("Có sẵn")).toBeNull();
    expect(screen.getByText("Tối đa mỗi món")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows '—' for 'Bán độc lập' when allowStandalone is false", () => {
    render(
      <ModifierDetailView
        modifier={linkedModifier}
        product={linkedProduct}
        groupName="Thêm Topping"
        allowStandalone={false}
        groupSelectionMode="MANY"
        canDelete={false}
        returnTo="/admin/products/modifiers"
      />,
    );

    const row = screen.getByText("Bán độc lập").closest<HTMLElement>("div.grid")!;
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("shows 'Ngừng dùng' for ACTIVE modifier and calls setModifierStatus with INACTIVE after confirm", async () => {
    confirmMock.mockResolvedValue(true);
    setModifierStatusMock.mockResolvedValue({});
    render(
      <ModifierDetailView
        modifier={linkedModifier}
        product={linkedProduct}
        groupName="Thêm Topping"
        allowStandalone={true}
        canDelete={true}
        returnTo="/admin/products/modifiers"
      />,
    );

    const pauseBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    expect(pauseBtn).toBeInTheDocument();
    expect(screen.queryByText("Trạng thái")).toBeNull();

    fireEvent.click(pauseBtn);

    expect(confirmMock).toHaveBeenCalledWith({
      title: "Ngừng dùng",
      message: 'Ngừng "Trân châu đen"? Máy bán hàng sẽ không còn hiện nó ở phần thêm topping lẫn món bán riêng Trân châu đen.',
      variant: "danger",
    });

    await waitFor(() => {
      expect(setModifierStatusMock).toHaveBeenCalled();
    });
    const fd = setModifierStatusMock.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("MOD-001");
    expect(fd.get("status")).toBe("INACTIVE");
  });

  it("shows fallback confirm message when modifier has no active linked product", async () => {
    confirmMock.mockResolvedValue(true);
    setModifierStatusMock.mockResolvedValue({});
    const { unmount } = render(
      <ModifierDetailView
        modifier={unlinkedModifier}
        product={null}
        groupName="Chọn Size"
        allowStandalone={false}
        canDelete={true}
        returnTo="/admin/products/modifiers"
      />,
    );

    const pauseBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    fireEvent.click(pauseBtn);

    expect(confirmMock).toHaveBeenCalledWith({
      title: "Ngừng dùng",
      message: 'Ngừng dùng tuỳ chọn "Size L"? Máy bán hàng sẽ không còn hiện tuỳ chọn này.',
      variant: "danger",
    });

    unmount();

    render(
      <ModifierDetailView
        modifier={linkedModifier}
        product={{ ...linkedProduct, status: "INACTIVE" }}
        groupName="Thêm Topping"
        allowStandalone={true}
        canDelete={true}
        returnTo="/admin/products/modifiers"
      />,
    );

    const pauseBtn2 = screen.getByRole("button", { name: "Ngừng dùng" });
    fireEvent.click(pauseBtn2);

    expect(confirmMock).toHaveBeenCalledWith({
      title: "Ngừng dùng",
      message: 'Ngừng dùng tuỳ chọn "Trân châu đen"? Máy bán hàng sẽ không còn hiện tuỳ chọn này.',
      variant: "danger",
    });
  });

  it("shows 'Dùng lại' and badge 'Ngừng dùng' for INACTIVE modifier, calls setModifierStatus with ACTIVE", async () => {
    setModifierStatusMock.mockResolvedValue({});
    const inactiveModifier: DBModifier = {
      ...linkedModifier,
      status: "INACTIVE",
    };
    render(
      <ModifierDetailView
        modifier={inactiveModifier}
        product={linkedProduct}
        groupName="Thêm Topping"
        allowStandalone={true}
        canDelete={true}
        returnTo="/admin/products/modifiers"
      />,
    );

    const resumeBtn = screen.getByRole("button", { name: "Dùng lại" });
    expect(resumeBtn).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).toBeNull();
    expect(screen.getAllByText("Ngừng dùng")).toHaveLength(1);
    expect(screen.queryByText("Trạng thái")).toBeNull();

    fireEvent.click(resumeBtn);
    expect(confirmMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(setModifierStatusMock).toHaveBeenCalled();
    });
    const fd = setModifierStatusMock.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("MOD-001");
    expect(fd.get("status")).toBe("ACTIVE");
  });

  it("hides 'Xoá' button when canDelete is false", () => {
    render(
      <ModifierDetailView
        modifier={linkedModifier}
        product={linkedProduct}
        groupName="Thêm Topping"
        allowStandalone={true}
        canDelete={false}
        returnTo="/admin/products/modifiers"
      />,
    );

    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });
});

