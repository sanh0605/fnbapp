import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditModifierPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/products/modifiers/actions", () => ({
  getModifiersData: vi.fn().mockResolvedValue({
    modifiers: [
      {
        id: "MOD-001",
        name: "Trân châu đen",
        group_name: "Thêm Topping",
        price: "5000",
        status: "ACTIVE",
        product_id: null,
      },
    ],
  }),
  saveModifierAction: vi.fn(),
  deleteModifierAction: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/admin/products/modifiers/components/ModifierForm", () => ({
  ModifierForm: (props: any) => <div data-testid="modifier-form" {...props} />,
}));

describe("EditModifierPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when modifier id is unknown", async () => {
    await expect(
      EditModifierPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/products/modifiers/MOD-001?returnTo=%2Fadmin%2Fproducts%2Fmodifiers%3Fq%3Dtran";
    const element = await EditModifierPage({
      params: { id: "MOD-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/products/modifiers?q=tran";
    const element = await EditModifierPage({
      params: { id: "MOD-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/products/modifiers/MOD-001?returnTo=" + encodeURIComponent("/admin/products/modifiers?q=tran"),
    );
  });
});
