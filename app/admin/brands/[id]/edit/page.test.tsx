import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditBrandPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/brands/actions", () => ({
  getBrands: vi.fn().mockResolvedValue([
    { id: "BR-001", name: "Phin Đi", status: "ACTIVE" },
  ]),
}));

vi.mock("@/app/admin/brands/components/BrandForm", () => ({
  BrandForm: (props: any) => <div data-testid="brand-form" {...props} />,
}));

describe("EditBrandPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when brand id is unknown", async () => {
    await expect(
      EditBrandPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/brands/BR-001?returnTo=%2Fadmin%2Fbrands%3Fq%3Dphin";
    const element = await EditBrandPage({
      params: { id: "BR-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/brands?q=phin";
    const element = await EditBrandPage({
      params: { id: "BR-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/brands/BR-001?returnTo=" + encodeURIComponent("/admin/brands?q=phin"),
    );
  });
});
