// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import React from "react";
import ModifiersClient from "./ModifiersClient";
import type { DBModifier } from "@/types/db";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/products/modifiers",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({
  deleteModifierAction: vi.fn(),
}));

vi.mock("@/app/admin/products/modifiers/actions", () => ({
  deleteModifierAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleModifiers: DBModifier[] = [
  {
    id: "MOD-001",
    name: "Trân châu đen",
    price: "5000",
    status: "ACTIVE",
    product_id: "PROD-035",
    group_id: "MG-001",
    is_default: false,
    max_qty: null,
  },
  {
    id: "MOD-002",
    name: "Size L",
    price: "10000",
    status: "ACTIVE",
    product_id: null,
    group_id: "MG-001",
    is_default: false,
    max_qty: null,
  },
];

const sampleToppings = [
  { id: "PROD-035", name: "Trân châu đen", category_id: "CAT-007", status: "ACTIVE" },
];

describe("ModifiersClient", () => {
  it("has no 'Sửa' or '/edit' link", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
      />,
    );

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("row link for MOD-001 starts with /admin/products/modifiers/MOD-001?returnTo=", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
      />,
    );

    const allLinks = screen.getAllByRole("link");
    const mod1Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/products/modifiers/MOD-001?returnTo="),
    );
    expect(mod1Links.length).toBeGreaterThan(0);
  });

  it("bin 'Xoá' is present when canDelete is true", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
        canDelete={true}
      />,
    );

    const binButtons = screen.getAllByRole("button", { name: /Xoá/i });
    expect(binButtons.length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
      />,
    );

    const codeElements = screen.getAllByText(/^MOD-00[12]$/);
    expect(codeElements[0].textContent).toBe("MOD-002");
    expect(codeElements[1].textContent).toBe("MOD-001");
  });

  it("'Bán độc lập' shows 'Có' for a modifier linked to an ACTIVE topping product and 'Không' for one with product_id null", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
      />,
    );

    expect(screen.getAllByText("Có").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Không").length).toBeGreaterThan(0);
  });

  it("has no switch (no role 'switch') on the list", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
      />,
    );

    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("search by group name works", () => {
    render(
      <ModifiersClient
        modifiers={[sampleModifiers[0], { ...sampleModifiers[1], group_id: "MG-002" }]}
        toppings={sampleToppings}
        groups={[
          { id: "MG-001", name: "Thêm Topping", selection_mode: "MANY", max_total: null, allow_standalone: true, sort_order: 50, status: "ACTIVE" },
          { id: "MG-002", name: "Chọn Size", selection_mode: "ONE", max_total: null, allow_standalone: false, sort_order: 10, status: "ACTIVE" },
        ]}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Ví dụ: Trân châu trắng");
    fireEvent.change(searchInput, { target: { value: "Chọn Size" } });

    expect(screen.getAllByText("Size L").length).toBeGreaterThan(0);
    expect(screen.queryByText("Trân châu đen")).toBeNull();
  });

  it("create link reads 'Tạo' and points to /admin/products/modifiers/new", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
      />,
    );

    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/products/modifiers/new?returnTo=");
  });

  it("hides remove controls when canDelete is false", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={sampleToppings}
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /Xoá/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("shows 'Ngừng dùng' badge on INACTIVE rows and cards", () => {
    const inactiveModifiers: DBModifier[] = [
      {
        ...sampleModifiers[0],
        id: "MOD-007",
        name: "Dâu sấy",
        status: "INACTIVE",
      },
    ];
    const { container } = render(
      <ModifiersClient
        modifiers={inactiveModifiers}
        toppings={sampleToppings}
        groups={[
          {
            id: "MG-001",
            name: "Thêm Topping",
            selection_mode: "MANY",
            max_total: null,
            allow_standalone: true,
            sort_order: 50,
            status: "ACTIVE",
          },
        ]}
      />,
    );

    const badges = screen.getAllByText("Ngừng dùng");
    expect(badges.length).toBeGreaterThanOrEqual(2);
    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    expect(within(phone).getByText("Dâu sấy")).toBeInTheDocument();
    expect(within(phone).getByText("5,000")).toBeInTheDocument();
    expect(within(phone).getByText("Thêm Topping · MOD-007 · Bán độc lập: Có")).toBeInTheDocument();
    expect(within(phone).getByText("Ngừng dùng")).toBeInTheDocument();
  });
});
