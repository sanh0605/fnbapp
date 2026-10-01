// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("./StandaloneToppingSwitch", () => ({
  StandaloneToppingSwitch: () => <span>switch</span>,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleModifiers: DBModifier[] = [
  {
    id: "MOD-001",
    name: "Trân châu đen",
    group_name: "Thêm Topping",
    price: "5000",
    status: "ACTIVE",
    product_id: null,
  },
];

describe("ModifiersClient", () => {
  it("renders '+ Thêm Tùy Chọn' link pointing to new modifier page with returnTo", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={[]}
        initialSearch="Trân châu"
      />
    );

    const addLink = screen.getByRole("link", { name: "+ Thêm Tùy Chọn" });
    expect(addLink).toHaveAttribute(
      "href",
      "/admin/products/modifiers/new?returnTo=" + encodeURIComponent("/admin/products/modifiers?q=Tr%C3%A2n+ch%C3%A2u")
    );
  });

  it("renders 'Sửa' as a link pointing to the modifier's edit page", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={[]}
        initialSearch=""
      />
    );

    const editLinks = screen.getAllByRole("link", { name: "Sửa" });
    expect(editLinks[0]).toHaveAttribute(
      "href",
      "/admin/products/modifiers/MOD-001/edit?returnTo=" + encodeURIComponent("/admin/products/modifiers")
    );
  });

  it("typing in search field replaces URL with ?q= and scroll: false", () => {
    render(
      <ModifiersClient
        modifiers={sampleModifiers}
        toppings={[]}
        initialSearch=""
      />
    );

    const searchInput = screen.getByPlaceholderText("Tên hoặc nhóm...");
    fireEvent.change(searchInput, { target: { value: "Thạch" } });

    expect(replace).toHaveBeenLastCalledWith("/admin/products/modifiers?q=Th%E1%BA%A1ch", { scroll: false });
  });
});
