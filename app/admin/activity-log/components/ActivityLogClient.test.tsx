// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import ActivityLogClient from "./ActivityLogClient";

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
});

