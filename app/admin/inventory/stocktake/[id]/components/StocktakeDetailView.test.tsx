// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
  notes: "",
  lines: [
    {
      id: "LINE-1",
      itemReference: "SPM-004",
      itemType: "PURCHASED_ITEM",
      itemName: "Bột cà phê truyền thống Phin Đậm",
      unitName: "g",
      countedQty: 4000,
      theoreticalAtCount: 6000,
      countedAt: "2026-08-09T15:00:00.000Z",
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
});
