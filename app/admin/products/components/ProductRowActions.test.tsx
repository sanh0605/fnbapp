// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ProductRowActions } from "./ProductRowActions";

const mocks = vi.hoisted(() => ({
  pauseProduct: vi.fn(),
  resumeProduct: vi.fn(),
  eraseProduct: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("@/app/admin/products/actions", () => ({
  pauseProduct: mocks.pauseProduct,
  resumeProduct: mocks.resumeProduct,
  eraseProduct: mocks.eraseProduct,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductRowActions", () => {
  it("renders 'Sửa' link to edit page with encoded returnTo", () => {
    const product = {
      id: "PROD-001",
      name: "Cà phê đá",
      status: "ACTIVE",
      neverSold: false,
    };
    render(
      <ProductRowActions
        product={product}
        canDelete={false}
        returnTo="/admin/products?status=INACTIVE"
      />
    );
    const editLink = screen.getByRole("link", { name: "Sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      "/admin/products/PROD-001/edit?returnTo=" + encodeURIComponent("/admin/products?status=INACTIVE")
    );
  });

  it("shows 'Xoá vĩnh viễn' when neverSold is true and canDelete is true", () => {
    const product = {
      id: "PROD-002",
      name: "Món mới chưa bán",
      status: "ACTIVE",
      neverSold: true,
    };
    render(
      <ProductRowActions
        product={product}
        canDelete={true}
        returnTo="/admin/products"
      />
    );
    expect(screen.getByRole("button", { name: "Xoá vĩnh viễn" })).toBeInTheDocument();
  });

  it("hides 'Xoá vĩnh viễn' when neverSold is false", () => {
    const product = {
      id: "PROD-003",
      name: "Món đã bán",
      status: "ACTIVE",
      neverSold: false,
    };
    render(
      <ProductRowActions
        product={product}
        canDelete={true}
        returnTo="/admin/products"
      />
    );
    expect(screen.queryByRole("button", { name: "Xoá vĩnh viễn" })).toBeNull();
  });

  it("hides 'Xoá vĩnh viễn' when canDelete is false even if neverSold is true", () => {
    const product = {
      id: "PROD-004",
      name: "Món chưa bán",
      status: "ACTIVE",
      neverSold: true,
    };
    render(
      <ProductRowActions
        product={product}
        canDelete={false}
        returnTo="/admin/products"
      />
    );
    expect(screen.queryByRole("button", { name: "Xoá vĩnh viễn" })).toBeNull();
  });
});
