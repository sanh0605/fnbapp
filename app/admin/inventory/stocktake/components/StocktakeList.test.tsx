// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { StocktakeList } from "./StocktakeList";
import type { StocktakeListRow } from "../actions";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/admin/inventory/stocktake",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({
  startStocktakeSession: vi.fn(),
}));

afterEach(cleanup);

describe("StocktakeList (Screen 1)", () => {
  it("Tạo disabled while one is open", () => {
    const sessions: StocktakeListRow[] = [
      {
        id: "STK-002",
        status: "OPEN",
        at: "2026-10-15T10:00:00.000Z",
        personName: "Admin",
        countedLines: 12,
        totalLines: 50,
        shortValue: 50000,
        foundValue: 0,
        isLatestConfirmed: false,
      },
      {
        id: "STK-001",
        status: "CONFIRMED",
        at: "2026-08-09T15:02:24.000Z",
        personName: "Admin",
        countedLines: 50,
        totalLines: 50,
        shortValue: 296033,
        foundValue: 0,
        isLatestConfirmed: true,
      },
    ];

    render(<StocktakeList sessions={sessions} />);

    const createButton = screen.getAllByRole("button", { name: "Tạo phiên kiểm kê" })[0];
    expect(createButton).toBeDisabled();

    expect(screen.getByText(/Đang có phiên/)).toBeInTheDocument();
    expect(screen.getAllByText("STK-002").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/chưa xác nhận/)).toBeInTheDocument();
  });

  it("Tạo enabled when no open session", () => {
    const sessions: StocktakeListRow[] = [
      {
        id: "STK-001",
        status: "CONFIRMED",
        at: "2026-08-09T15:02:24.000Z",
        personName: "Admin",
        countedLines: 50,
        totalLines: 50,
        shortValue: 296033,
        foundValue: 0,
        isLatestConfirmed: true,
      },
    ];

    render(<StocktakeList sessions={sessions} />);

    const createButton = screen.getAllByRole("button", { name: "Tạo phiên kiểm kê" })[0];
    expect(createButton).not.toBeDisabled();
    expect(screen.queryByText(/chưa xác nhận/)).toBeNull();
  });

  it("renders empty state 'Chưa có phiên kiểm kê nào' when sessions is empty", () => {
    render(<StocktakeList sessions={[]} />);

    expect(screen.getByText("Chưa có phiên kiểm kê nào")).toBeInTheDocument();
    const createBtns = screen.getAllByRole("button", { name: "Tạo phiên kiểm kê" });
    expect(createBtns[0]).not.toBeDisabled();
  });

  it("displays correct status and diff value for OPEN, CONFIRMED, and REVERSED sessions", () => {
    const sessions: StocktakeListRow[] = [
      {
        id: "STK-003",
        status: "OPEN",
        at: "2026-10-15T09:00:00.000Z",
        personName: "Admin",
        countedLines: 2,
        totalLines: 3,
        shortValue: 20000,
        foundValue: 150,
        isLatestConfirmed: false,
      },
      {
        id: "STK-002",
        status: "REVERSED",
        at: "2026-09-01T08:00:00.000Z",
        personName: "Admin",
        countedLines: 50,
        totalLines: 50,
        shortValue: null,
        foundValue: null,
        isLatestConfirmed: false,
      },
      {
        id: "STK-001",
        status: "CONFIRMED",
        at: "2026-08-09T15:02:24.000Z",
        personName: "Admin",
        countedLines: 50,
        totalLines: 50,
        shortValue: 296033,
        foundValue: 0,
        isLatestConfirmed: true,
      },
    ];

    const { container } = render(<StocktakeList sessions={sessions} />);

    expect(screen.getAllByText("Đang đếm").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Đã hoàn tác").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Đã xác nhận").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText(/thiếu 20,000đ · thừa 150đ \(tạm tính\)/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("thiếu 296,033đ").length).toBeGreaterThanOrEqual(1);

    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    expect(within(phone).getByText("Tạm tính · STK-003 · Admin · Đã đếm 2/3")).toBeInTheDocument();
    expect(within(phone).getByText("STK-002 · Admin · Đã đếm 50/50")).toBeInTheDocument();
    expect(within(phone).getByText("STK-001 · Admin · Đã đếm 50/50")).toBeInTheDocument();
  });

  it("searching by login finds the row", () => {
    const sessions = [
      {
        id: "STK-001",
        status: "CONFIRMED" as const,
        at: "2026-08-09T15:02:24.000Z",
        personName: "Tài Chí Tuyền",
        login: "tuyen2612",
        countedLines: 50,
        totalLines: 50,
        shortValue: 0,
        foundValue: 0,
        isLatestConfirmed: true,
      },
      {
        id: "STK-002",
        status: "CONFIRMED" as const,
        at: "2026-08-10T15:02:24.000Z",
        personName: "Nguyễn Văn A",
        login: "anv",
        countedLines: 10,
        totalLines: 10,
        shortValue: 0,
        foundValue: 0,
        isLatestConfirmed: false,
      },
    ];

    render(<StocktakeList sessions={sessions} />);
    const input = screen.getByRole("textbox", { name: "Tìm kiếm" });
    fireEvent.change(input, { target: { value: "tuyen2612" } });

    expect(screen.getByText("STK-001")).toBeInTheDocument();
    expect(screen.queryByText("STK-002")).toBeNull();
  });
});
