// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { StocktakeDetailView } from "./StocktakeDetailView";
import type { StocktakeSessionView } from "../../actions";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/admin/inventory/stocktake/STK-001",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const confirmedSession: StocktakeSessionView = {
  id: "STK-001",
  status: "CONFIRMED",
  createdByName: "Admin",
  createdAt: "2026-08-09T15:02:24.000Z",
  confirmedAt: "2026-10-10T09:00:00Z",
  confirmedByName: "Chủ quán",
  lines: [
    {
      id: "LINE-1",
      itemReference: "SPM-004",
      itemName: "Bột cà phê truyền thống Phin Đậm",
      unitName: "g",
      countedQty: 4000,
      theoreticalAtCount: 6000,
      countedAt: "2026-08-09T15:00:00.000Z",
      packageCounts: null,
      packageLines: [],
      groupName: "Nguyên liệu",
      state: "OFF",
      unitCost: 148,
      diffValue: -296033,
    },
  ],
};

const reversedSession: StocktakeSessionView = {
  ...confirmedSession,
  id: "STK-000",
  status: "REVERSED",
};

describe("StocktakeDetailView (Screen 3)", () => {
  it("older or reversed session shows no Hoàn tác", () => {
    // 1. Reversed session
    const { rerender } = render(
      <StocktakeDetailView
        session={reversedSession}
        isLatestConfirmed={false}
        isOwner={true}
      />
    );
    expect(screen.queryByRole("link", { name: "Hoàn tác" })).toBeNull();
    expect(screen.getByText("Phiếu đã hoàn tác.")).toBeInTheDocument();

    // 2. Older confirmed session (isLatestConfirmed = false)
    rerender(
      <StocktakeDetailView
        session={confirmedSession}
        isLatestConfirmed={false}
        isOwner={true}
      />
    );
    expect(screen.queryByRole("link", { name: "Hoàn tác" })).toBeNull();
    expect(
      screen.getByText("Đã có phiếu kiểm kê mới hơn nên phiếu này không sửa hoặc hoàn tác được.")
    ).toBeInTheDocument();
  });

  it("newest confirmed session with owner shows Sửa số đếm and Hoàn tác buttons", () => {
    render(
      <StocktakeDetailView
        session={confirmedSession}
        isLatestConfirmed={true}
        isOwner={true}
      />
    );
    expect(screen.getByRole("link", { name: "Sửa số đếm" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hoàn tác" })).toBeInTheDocument();
  });

  it("displays confirmedByName and confirmedAt (item 8)", () => {
    render(
      <StocktakeDetailView
        session={confirmedSession}
        isLatestConfirmed={true}
        isOwner={true}
      />
    );
    expect(screen.getByText("Chủ quán")).toBeInTheDocument();
    expect(screen.getByText(formatDateTimeFull("2026-10-10T09:00:00Z"))).toBeInTheDocument();
  });

  it("filter chips: no Chưa đếm chip without blank lines; the picked chip is pressed", () => {
    render(
      <StocktakeDetailView
        session={confirmedSession}
        isLatestConfirmed={true}
        isOwner={true}
      />
    );
    expect(screen.queryByRole("button", { name: /Chưa đếm/ })).toBeNull();
    const all = screen.getByRole("button", { name: "Tất cả (1)" });
    expect(all).toHaveAttribute("aria-pressed", "true");

    const off = screen.getByRole("button", { name: "Lệch (1)" });
    fireEvent.click(off);
    expect(off).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
  });

  it("filter chips: a blank line shows the Chưa đếm chip", () => {
    const blankLine = { ...confirmedSession.lines[0], id: "LINE-2", countedQty: null, diffValue: null, state: "BLANK" as const };
    render(
      <StocktakeDetailView
        session={{ ...confirmedSession, lines: [...confirmedSession.lines, blankLine] }}
        isLatestConfirmed={true}
        isOwner={true}
      />
    );
    expect(screen.getByRole("button", { name: "Chưa đếm (1)" })).toBeInTheDocument();
  });

  it("renders stocktake line items on phone as a divide-y list of PhoneRow", () => {
    const { container } = render(
      <StocktakeDetailView
        session={confirmedSession}
        isLatestConfirmed={true}
        isOwner={true}
      />
    );

    const phoneContainer = container.querySelector(".md\\:hidden");
    expect(phoneContainer).not.toBeNull();
    expect(phoneContainer?.className).toContain("divide-y");
    expect(phoneContainer?.className).not.toContain("space-y-3");

    const rows = phoneContainer?.querySelectorAll(":scope > div");
    expect(rows?.length).toBe(1);
    const firstRow = rows?.[0];
    expect(firstRow?.className).toContain("px-4");
    expect(firstRow?.className).toContain("py-2.5");
    expect(firstRow?.className).not.toContain("p-4");

    // PhoneRow: Line 1 has item name and value difference
    expect(firstRow?.textContent).toContain("Bột cà phê truyền thống Phin Đậm");
    expect(firstRow?.textContent).toContain("-296,033đ");

    // PhoneRow: Line 2 has quantity info
    expect(firstRow?.textContent).toContain("Sổ 6,000 g · Đếm 4,000 g · Thiếu 2,000 g");

    // Old card labels are not present on phone
    expect(firstRow?.textContent).not.toContain("Sổ lúc đếm");
    expect(firstRow?.textContent).not.toContain("Chênh lệch số lượng");
    expect(firstRow?.textContent).not.toContain("Chênh lệch giá trị");
  });
});
