import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditPromotionPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/promotions/actions", () => ({
  getPromotionsData: vi.fn().mockResolvedValue({
    promotions: [
      { id: "PRM-004", name: "202607 - GIẢM 10K", status: "ACTIVE" },
    ],
    brands: [],
    products: [],
    variants: [],
    categories: [],
  }),
}));

vi.mock("@/app/admin/promotions/components/PromotionForm", () => ({
  PromotionForm: (props: any) => <div data-testid="promotion-form" {...props} />,
}));

describe("EditPromotionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when promotion id is unknown", async () => {
    await expect(
      EditPromotionPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/promotions/PRM-004?returnTo=%2Fadmin%2Fpromotions%3Fq%3Dgiam";
    const element = await EditPromotionPage({
      params: { id: "PRM-004" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/promotions?q=giam";
    const element = await EditPromotionPage({
      params: { id: "PRM-004" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/promotions/PRM-004?returnTo=" + encodeURIComponent("/admin/promotions?q=giam"),
    );
  });
});
