// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import React from "react";
import { ProductCategoryDetailView } from "./ProductCategoryDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/products/categories/CAT-001",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/products/categories/actions", () => ({
  deleteCategory: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleCategory = {
  id: "CAT-001",
  name: "Cà phê",
  status: "ACTIVE",
  type_id: "PT-001",
};

const sampleDishes = [
  { id: "PROD-001", name: "Cà phê đá", status: "ACTIVE" },
  { id: "PROD-009", name: "Bạc xỉu", status: "INACTIVE" },
];

describe("ProductCategoryDetailView", () => {
  it("renders Cà phê CAT-001 with dishes, status label, edit link", () => {
    const returnTo = "/admin/products/categories";
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={sampleDishes.length}
        dishes={sampleDishes}
        canDelete={true}
        returnTo={returnTo}
      />,
    );

    // "Món trong nhóm (2)"
    expect(screen.getByText("Món trong nhóm (2)")).toBeInTheDocument();

    // dish link /admin/products/PROD-001
    const links = screen.getAllByRole("link");
    const prod1Link = links.find(
      (l) => l.getAttribute("href") === "/admin/products/PROD-001",
    );
    expect(prod1Link).toBeDefined();

    // "Ngừng bán" label for PROD-009
    expect(screen.getAllByText("Ngừng bán").length).toBeGreaterThan(0);

    // "Chỉnh sửa" link to /admin/products/categories/CAT-001/edit?returnTo=
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink.getAttribute("href")).toContain(
      "/admin/products/categories/CAT-001/edit?returnTo=",
    );

    // "Xoá" button hidden because group has dishes
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("shows 'Xoá' button when canDelete is true and group has 0 dishes", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={0}
        dishes={[]}
        canDelete={true}
        returnTo="/admin/products/categories"
      />,
    );

    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });

  it("hides 'Xoá' button when not owner (canDelete is false) even with 0 dishes", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={0}
        dishes={[]}
        canDelete={false}
        returnTo="/admin/products/categories"
      />,
    );

    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("hides 'Xoá' button when group has dishes even for owner (canDelete is true)", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={sampleDishes.length}
        dishes={sampleDishes}
        canDelete={true}
        returnTo="/admin/products/categories"
      />,
    );

    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("renders empty state message when group has no dishes", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={0}
        dishes={[]}
        returnTo="/admin/products/categories"
      />,
    );

    expect(screen.getByText("Chưa có món nào trong nhóm này.")).toBeInTheDocument();
  });

  it("renders Loại món field", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        typeName="Đồ uống"
        dishCount={0}
        dishes={[]}
        returnTo="/admin/products/categories"
      />,
    );

    expect(screen.getByText("Loại món")).toBeInTheDocument();
    expect(screen.getByText("Đồ uống")).toBeInTheDocument();
  });

  it("renders dishes on phone as a divide-y list of PhoneRow links with 48px controls", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={sampleDishes.length}
        dishes={sampleDishes}
        canDelete={false}
        returnTo="/admin/products/categories"
      />
    );

    const mobileList = document.querySelector(".md\\:hidden") as HTMLElement;
    expect(mobileList).toBeInTheDocument();
    expect(mobileList.className).toContain("divide-y");

    const links = within(mobileList).getAllByRole("link");
    expect(links).toHaveLength(2);

    const firstLink = links[0];
    expect(firstLink).toHaveAttribute("href", "/admin/products/PROD-001");
    expect(firstLink.className).toContain("px-4");
    expect(firstLink.className).toContain("py-2.5");
    expect(firstLink.className).toContain("min-h-[48px]");
    expect(firstLink.className).not.toContain("min-h-[44px]");
    expect(firstLink.className).not.toContain("p-4");

    // PhoneRow: title on line 1, meta & badge on line 2
    expect(within(firstLink).getByText("Cà phê đá")).toBeInTheDocument();
    expect(within(firstLink).getByText("PROD-001")).toBeInTheDocument();
    expect(within(firstLink).queryByText("Đang bán")).toBeNull();

    const secondLink = links[1];
    expect(within(secondLink).getByText("Bạc xỉu")).toBeInTheDocument();
    expect(within(secondLink).getByText("Ngừng bán")).toBeInTheDocument();
  });
});
