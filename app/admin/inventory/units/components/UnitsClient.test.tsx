// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import UnitsClient from "./UnitsClient";
import type { DBUnit } from "@/types/db";
import { deleteUnit } from "@/app/admin/inventory/actions";
import { confirm } from "@/lib/shared/dialog";

const { replace, refresh, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/units",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/inventory/actions", () => ({
  deleteUnit: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
}));

const UNITS: DBUnit[] = [
  { id: "UNT-001", name: "Hộp", abbreviation: "", description: "Hộp giấy", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-010", name: "Combo 2", abbreviation: "", description: "Bộ đôi sản phẩm", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnitsClient", () => {
  it("renders row linking to detail page instead of removed Sửa button", () => {
    render(
      <UnitsClient
        units={UNITS}
        canDelete={false}
      />,
    );

    // No "Sửa" link
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();

    // Row links to detail page
    const links = screen.getAllByRole("link", { name: /Hộp/ });
    expect(links.length).toBeGreaterThan(0);
    expect(
      links.some((l) =>
        l.getAttribute("href")?.startsWith("/admin/inventory/units/UNT-001?returnTo=")
      )
    ).toBe(true);
  });

  it("links '+ Thêm Đơn vị' to new page with returnTo", () => {
    render(
      <UnitsClient
        units={UNITS}
        canDelete={false}
      />,
    );

    const addLink = screen.getByRole("link", { name: "+ Thêm Đơn vị" });
    expect(addLink.getAttribute("href")).toContain("/admin/inventory/units/new?returnTo=");
  });

  it("canDelete=false renders no checkboxes and no removal bin", () => {
    render(
      <UnitsClient
        units={UNITS}
        canDelete={false}
      />,
    );

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  // The owner's Combo 2 case moved from UnitForm.test.tsx:
  // A refusal message from deleteUnit is shown to the user via the bin
  it("shows refusal message when deleting a unit that is in use (Combo 2 case)", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const refusalMessage =
      "Không xoá được đơn vị Combo 2 vì đang được dùng trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy đổi đó trước.";
    vi.mocked(deleteUnit).mockResolvedValue({ error: refusalMessage });

    render(
      <UnitsClient
        units={UNITS}
        canDelete={true}
      />,
    );

    // Find the bin button for "Combo 2"
    const deleteBtn = screen.getAllByRole("button", { name: "Xoá Combo 2" })[0];
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteUnit).toHaveBeenCalled();
    });

    // The refusal message must be surfaced to the user
    await waitFor(() => {
      expect(screen.getByText(refusalMessage)).toBeInTheDocument();
    });
  });
});
