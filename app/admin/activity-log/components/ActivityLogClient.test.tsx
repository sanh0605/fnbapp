// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import ActivityLogClient from "./ActivityLogClient";
import type { ActivityLogEvent as OrderEvent } from "../actions";

// BR-UI-007: the list now takes its range from the page.
const TEST_TODAY = "2026-10-09";
const TEST_RANGE = { preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" } as const;

// DayInput asks matchMedia whether it is on a phone.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// push added in wave K6: the day boxes push the new filter onto the address.
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

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/activity-log",
  useSearchParams: () => mockSearchParams,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ActivityLogClient", () => {
  it("renders event type options with Vietnamese-only labels (no English)", () => {
    render(
      <ActivityLogClient range={TEST_RANGE} today={TEST_TODAY}
        initialEvents={[]}
        actors={["admin"]}
        actorLabel={null}
        totalCount={0}
        itemsPerPage={20}
      />
    );

    expect(screen.getByRole("option", { name: "Tạo mới" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Huỷ đơn" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mở lại" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Di trú" })).toBeInTheDocument();

    // English names in parentheses must NOT be present
    expect(screen.queryByText(/CREATED/)).toBeNull();
    expect(screen.queryByText(/EDITED/)).toBeNull();
    expect(screen.queryByText(/VOIDED/)).toBeNull();
    expect(screen.queryByText(/REOPENED/)).toBeNull();
    expect(screen.queryByText(/MIGRATED/)).toBeNull();
  });

  it("with the initial actor 'Hệ thống' not in actors, the select's value is 'Hệ thống' and an option named 'Hệ thống' exists", () => {
    mockSearchParams.set("actor", "Hệ thống");
    render(
      <ActivityLogClient
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialEvents={[]}
        actors={["admin"]}
        actorLabel={null}
        totalCount={0}
        itemsPerPage={20}
      />
    );

    const select = screen.getByLabelText("Tài khoản") as HTMLSelectElement;
    expect(select.value).toBe("Hệ thống");
    expect(screen.getByRole("option", { name: "Hệ thống" })).toBeInTheDocument();
  });

  it("an old ?actor=<login> link shows the person's label, with no extra choice named after the login", () => {
    mockSearchParams.set("actor", "admin");
    render(
      <ActivityLogClient
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialEvents={[]}
        actors={["Admin"]}
        actorLabel="Admin"
        totalCount={0}
        itemsPerPage={20}
      />
    );

    const select = screen.getByLabelText("Tài khoản") as HTMLSelectElement;
    expect(select.value).toBe("Admin");
    expect(screen.queryByRole("option", { name: "admin" })).toBeNull();
  });

  it("in phone list only, CREATED event row shows no 'Tạo mới' and EDITED event row shows 'Chỉnh sửa'", () => {
    const events: OrderEvent[] = [
      {
        id: "evt-created",
        order_id: "ord-1",
        order_no: "261018001",
        event_type: "CREATED",
        event_at: "2026-10-18T08:00:00Z",
        actor_id: "admin",
        actor_name: "Admin",
      },
      {
        id: "evt-edited",
        order_id: "ord-2",
        order_no: "261018002",
        event_type: "EDITED",
        event_at: "2026-10-18T09:00:00Z",
        actor_id: "admin",
        actor_name: "Admin",
      },
    ];

    const { container } = render(
      <ActivityLogClient
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialEvents={events}
        actors={["Admin"]}
        actorLabel={null}
        totalCount={2}
        itemsPerPage={20}
      />,
    );

    const phoneContainer = container.querySelector(".md\\:hidden.flex.flex-col") as HTMLElement;
    expect(phoneContainer).not.toBeNull();
    const phoneScope = within(phoneContainer);

    expect(phoneScope.queryByText("Tạo mới")).toBeNull();
    expect(phoneScope.getByText("Chỉnh sửa")).toBeInTheDocument();
  });

  it("shows 'Doanh thu thuần 20,000đ' when delta_json contains net_total 20000", () => {
    const events: OrderEvent[] = [
      {
        id: "evt-delta",
        order_id: "ord-1",
        order_no: "261018001",
        event_type: "EDITED",
        event_at: "2026-10-18T08:00:00Z",
        actor_id: "admin",
        actor_name: "Admin",
        delta_json: JSON.stringify({ net_total: 20000 }),
      },
    ];

    render(
      <ActivityLogClient
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialEvents={events}
        actors={["Admin"]}
        actorLabel={null}
        totalCount={1}
        itemsPerPage={20}
      />,
    );

    expect(screen.getByText("Doanh thu thuần 20,000đ")).toBeInTheDocument();
  });

  it("shows 'Doanh thu thuần 20,000đ' and NOT 'Doanh thu gốc' when gross_total equals net_total", () => {
    const events: OrderEvent[] = [
      {
        id: "evt-delta",
        order_id: "ord-1",
        order_no: "261018001",
        event_type: "EDITED",
        event_at: "2026-10-18T08:00:00Z",
        actor_id: "admin",
        actor_name: "Admin",
        delta_json: JSON.stringify({ net_total: 20000, gross_total: 20000, line_count: 1 }),
      },
    ];

    render(
      <ActivityLogClient
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialEvents={events}
        actors={["Admin"]}
        actorLabel={null}
        totalCount={1}
        itemsPerPage={20}
      />,
    );

    const cell = screen.getByText(/Doanh thu thuần 20,000đ/);
    expect(cell).toBeInTheDocument();
    expect(cell).not.toHaveTextContent("Doanh thu gốc");
  });

  it("shows both 'Doanh thu thuần 18,000đ' and 'Doanh thu gốc 20,000đ' when gross_total differs from net_total", () => {
    const events: OrderEvent[] = [
      {
        id: "evt-delta",
        order_id: "ord-1",
        order_no: "261018001",
        event_type: "EDITED",
        event_at: "2026-10-18T08:00:00Z",
        actor_id: "admin",
        actor_name: "Admin",
        delta_json: JSON.stringify({ net_total: 18000, gross_total: 20000, line_count: 1 }),
      },
    ];

    render(
      <ActivityLogClient
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialEvents={events}
        actors={["Admin"]}
        actorLabel={null}
        totalCount={1}
        itemsPerPage={20}
      />,
    );

    const cell = screen.getByText(/Doanh thu thuần 18,000đ/);
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveTextContent("Doanh thu gốc 20,000đ");
  });
});
