// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

vi.mock("@/app/admin/products/modifiers/actions", () => ({
  deleteModifierAction: vi.fn(),
}));

const standaloneSwitchMock = vi.fn((props: any) => (
  <div data-testid="mock-standalone-switch" data-modifier-id={props.modifierId}>
    StandaloneToppingSwitchMock
  </div>
));

vi.mock("@/app/admin/products/modifiers/components/StandaloneToppingSwitch", () => ({
  StandaloneToppingSwitch: (props: any) => standaloneSwitchMock(props),
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
  it("shows 'Món liên kết' link to /admin/products/PROD-035, 'Chỉnh sửa' link, and 'Xoá' button for linked modifier", () => {
    const returnTo = "/admin/products/modifiers";
    render(
      <ModifierDetailView
        modifier={linkedModifier}
        product={linkedProduct}
        groupName="Thêm Topping"
        allowStandalone={true}
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

    // StandaloneToppingSwitch mock rendered
    expect(screen.getByTestId("mock-standalone-switch")).toBeInTheDocument();
  });

  it("shows '—' for unlinked modifier", () => {
    const returnTo = "/admin/products/modifiers";
    render(
      <ModifierDetailView
        modifier={unlinkedModifier}
        product={null}
        groupName="Chọn Size"
        allowStandalone={false}
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

  it("uses groupName and allowStandalone props directly and does not pass groupName to StandaloneToppingSwitch", () => {
    standaloneSwitchMock.mockClear();
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
        returnTo="/admin/products/modifiers"
      />
    );

    // Displays groupName directly in "Nhóm" row
    expect(screen.getByText("Topping đặc biệt")).toBeInTheDocument();

    // StandaloneToppingSwitch receives allowStandalone directly and does not receive groupName prop
    expect(standaloneSwitchMock).toHaveBeenCalled();
    const passedProps = standaloneSwitchMock.mock.calls[0][0];
    expect(passedProps.allowStandalone).toBe(true);
    expect(passedProps.groupName).toBeUndefined();
  });
});
