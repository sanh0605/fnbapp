// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { ModifierGroupDetailView } from "./ModifierGroupDetailView";
import type { DBModifierGroup, DBModifier, DBProduct, DBProductCategory } from "@/types/db";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/products/modifier-groups/MG-001",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/products/modifier-groups/actions", () => ({
  deleteModifierGroup: vi.fn(),
  setModifierGroupStatus: vi.fn(),
}));

import { deleteModifierGroup, setModifierGroupStatus } from "@/app/admin/products/modifier-groups/actions";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleGroup: DBModifierGroup = {
  id: "MG-001",
  name: "Thêm Topping",
  selection_mode: "MANY",
  max_total: 3,
  allow_standalone: true,
  sort_order: 50,
  status: "ACTIVE",
};

const sampleOption: DBModifier = {
  id: "MOD-001",
  name: "Trân châu trắng",
  price: "5000",
  group_id: "MG-001",
  is_default: false,
  max_qty: 2,
  status: "ACTIVE",
  product_id: null,
};

const sampleProducts: DBProduct[] = [
  { id: "PROD-001", code: "CF01", name: "Cà phê đen", category_id: "CAT-001", status: "ACTIVE" },
  { id: "PROD-002", code: "CF02", name: "Cà phê sữa", category_id: "CAT-001", status: "ACTIVE" },
];

const sampleCategories: DBProductCategory[] = [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE", type_id: "PT-001" },
];

describe("ModifierGroupDetailView", () => {
  it("Xoá shows only for ADMIN and only when the group has no option", () => {
    // Case 1: ADMIN and 0 options -> Xoá is shown
    const { rerender } = render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[]}
        productIds={["PROD-001"]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={true}
        returnTo="/admin/products/modifier-groups"
      />
    );
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();

    // Case 2: Non-ADMIN and 0 options -> Xoá is NOT shown
    rerender(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[]}
        productIds={["PROD-001"]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={false}
        returnTo="/admin/products/modifier-groups"
      />
    );
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();

    // Case 3: ADMIN and >0 options -> Xoá is NOT shown (even if canDelete prop is true, view guards it)
    rerender(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[sampleOption]}
        productIds={["PROD-001"]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={true}
        returnTo="/admin/products/modifier-groups"
      />
    );
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("renders group info, options list, applied dishes, and 'Sửa' link", () => {
    render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[sampleOption]}
        productIds={["PROD-001"]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={false}
        returnTo="/admin/products/modifier-groups"
      />
    );

    // Title and fields
    expect(screen.getByRole("heading", { level: 1, name: "Thêm Topping" })).toBeInTheDocument();
    expect(screen.queryByText("MG-001")).toBeNull();
    expect(screen.getByText("Chọn nhiều")).toBeInTheDocument();
    expect(screen.getByText("3 phần")).toBeInTheDocument();
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);

    // Sửa link
    const editLink = screen.getByRole("link", { name: "Sửa" });
    expect(editLink).toBeInTheDocument();
    expect(editLink.getAttribute("href")).toContain("/admin/products/modifier-groups/MG-001/edit?returnTo=");

    // Option listed
    expect(screen.getAllByText("Trân châu trắng").length).toBeGreaterThan(0);

    // Product listed
    expect(screen.getAllByText("Cà phê đen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mã món")).toBeNull();
    expect(screen.queryByText("CF01")).toBeNull();
  });

  it("owner clicking Xoá prompts inline confirmation without dialog popup and calls deleteModifierGroup on confirm", async () => {
    (deleteModifierGroup as any).mockResolvedValue({ success: true });

    render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[]}
        productIds={[]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={true}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const deleteBtn = screen.getByRole("button", { name: "Xoá" });
    expect(deleteBtn).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click Xoá
    fireEvent.click(deleteBtn);

    // Inline confirmation, no popup dialog
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Xoá nhóm tuỳ chọn này?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();

    // Confirm deletion
    const confirmDeleteBtn = screen.getAllByRole("button", { name: "Xoá" })[0];
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteModifierGroup).toHaveBeenCalled();
    });

    const fd = (deleteModifierGroup as any).mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("MG-001");
    expect(push).toHaveBeenCalledWith("/admin/products/modifier-groups");
  });

  it("displays server error in role=alert box on deletion failure", async () => {
    (deleteModifierGroup as any).mockResolvedValue({
      error: "Nhóm còn tuỳ chọn: Trân châu trắng. Xoá hoặc chuyển tuỳ chọn trước.",
    });

    render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[]}
        productIds={[]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={true}
        returnTo="/admin/products/modifier-groups"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Xoá" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nhóm còn tuỳ chọn: Trân châu trắng. Xoá hoặc chuyển tuỳ chọn trước."
      );
    });
  });

  it("provides 'Ngừng dùng' button when ACTIVE and 'Dùng lại' when INACTIVE, calling setModifierGroupStatus", async () => {
    (setModifierGroupStatus as any).mockResolvedValue({ success: true });

    // Active group shows "Ngừng dùng"
    const { rerender } = render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[]}
        productIds={[]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={false}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const stopBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(setModifierGroupStatus).toHaveBeenCalled();
    });
    const fdStop = (setModifierGroupStatus as any).mock.calls[0][0] as FormData;
    expect(fdStop.get("id")).toBe("MG-001");
    expect(fdStop.get("status")).toBe("INACTIVE");

    // Inactive group shows "Dùng lại"
    rerender(
      <ModifierGroupDetailView
        group={{ ...sampleGroup, status: "INACTIVE" }}
        options={[]}
        productIds={[]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={false}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const resumeBtn = screen.getByRole("button", { name: "Dùng lại" });
    expect(resumeBtn).toBeInTheDocument();
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(setModifierGroupStatus).toHaveBeenCalledTimes(2);
    });
    const fdResume = (setModifierGroupStatus as any).mock.calls[1][0] as FormData;
    expect(fdResume.get("id")).toBe("MG-001");
    expect(fdResume.get("status")).toBe("ACTIVE");
  });

  it("renders options on phone as a divide-y list of PhoneRow without text-[10px] or p-4", () => {
    render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[sampleOption]}
        productIds={["PROD-001"]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={false}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const mobileLists = document.querySelectorAll(".md\\:hidden");
    const optionsList = mobileLists[0] as HTMLElement;
    expect(optionsList).toBeInTheDocument();
    expect(optionsList.className).toContain("divide-y");

    const optionRow = optionsList.firstElementChild as HTMLElement;
    expect(optionRow.className).toContain("px-4");
    expect(optionRow.className).toContain("py-2.5");
    expect(optionRow.className).not.toContain("p-4");

    // PhoneRow: title & value on line 1, meta & badge on line 2
    expect(within(optionRow).getByText("Trân châu trắng")).toBeInTheDocument();
    expect(within(optionRow).getByText("5,000đ")).toBeInTheDocument();
    expect(within(optionRow).getByText("Tối đa: 2")).toBeInTheDocument();
    expect(within(optionRow).getByText("Đang dùng")).toBeInTheDocument();

    // No text-[10px] anywhere in the row
    expect(optionRow.innerHTML).not.toContain("text-[10px]");
    // No font-medium inside row (BR-UI-003)
    expect(optionRow.querySelector(".font-medium")).toBeNull();
  });

  it("renders applied dishes on phone as a divide-y list of PhoneRow", () => {
    render(
      <ModifierGroupDetailView
        group={sampleGroup}
        options={[sampleOption]}
        productIds={["PROD-001"]}
        allProducts={sampleProducts}
        allCategories={sampleCategories}
        canDelete={false}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const mobileLists = document.querySelectorAll(".md\\:hidden");
    const appliedList = mobileLists[1] as HTMLElement;
    expect(appliedList).toBeInTheDocument();
    expect(appliedList.className).toContain("divide-y");

    const productRow = appliedList.firstElementChild as HTMLElement;
    expect(productRow.className).toContain("px-4");
    expect(productRow.className).toContain("py-2.5");
    expect(productRow.className).not.toContain("p-4");

    expect(within(productRow).getByText("Cà phê đen")).toBeInTheDocument();
    expect(within(productRow).getByText("Cà phê")).toBeInTheDocument();
    expect(productRow.querySelector(".font-medium")).toBeNull();
  });
});
