import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditOutletPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/outlets/actions", () => ({
  getOutlets: vi.fn().mockResolvedValue([
    { id: "OUT-001", name: "Điểm bán 1", status: "ACTIVE" },
  ]),
}));

vi.mock("@/app/admin/brands/actions", () => ({
  getBrands: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/admin/outlets/components/OutletForm", () => ({
  OutletForm: (props: any) => <div data-testid="outlet-form" {...props} />,
}));

describe("EditOutletPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when outlet id is unknown", async () => {
    await expect(
      EditOutletPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/outlets/OUT-001?returnTo=%2Fadmin%2Foutlets%3Fq%3D1";
    const element = await EditOutletPage({
      params: { id: "OUT-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/outlets?q=1";
    const element = await EditOutletPage({
      params: { id: "OUT-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/outlets/OUT-001?returnTo=" + encodeURIComponent("/admin/outlets?q=1"),
    );
  });
});
