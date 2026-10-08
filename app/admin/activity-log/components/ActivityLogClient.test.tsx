// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import ActivityLogClient from "./ActivityLogClient";

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
      <ActivityLogClient
        initialEvents={[]}
        actors={["admin"]}
        totalCount={0}
        itemsPerPage={20}
      />
    );

    expect(screen.getByRole("option", { name: "Tạo mới" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hủy đơn" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mở lại" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Di trú" })).toBeInTheDocument();

    // English names in parentheses must NOT be present
    expect(screen.queryByText(/CREATED/)).toBeNull();
    expect(screen.queryByText(/EDITED/)).toBeNull();
    expect(screen.queryByText(/VOIDED/)).toBeNull();
    expect(screen.queryByText(/REOPENED/)).toBeNull();
    expect(screen.queryByText(/MIGRATED/)).toBeNull();
  });
});

// Wave K6 (plan Review Focus 3): "Từ ngày" and "Đến ngày" move to the shared
// DayInput. A typed day puts from/to (yyyy-mm-dd) on the address as before; a
// day that is not a date is said under the box and the address stays put.
describe("ActivityLogClient day boxes (wave K6)", () => {
  const renderLog = () =>
    render(<ActivityLogClient initialEvents={[]} actors={["admin"]} totalCount={0} itemsPerPage={20} />);

  it("typing 15/09/2026 in Từ ngày puts from=2026-09-15 on the address", () => {
    renderLog();
    const from = screen.getByLabelText(/^Từ ngày( \*)?$/) as HTMLInputElement;
    fireEvent.change(from, { target: { value: "15/09/2026" } });
    fireEvent.blur(from);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe("/admin/activity-log?from=2026-09-15");
  });

  it("typing 32/13/2026 in Đến ngày says the day is wrong and leaves the address alone", async () => {
    renderLog();
    const to = screen.getByLabelText(/^Đến ngày( \*)?$/) as HTMLInputElement;
    fireEvent.change(to, { target: { value: "32/13/2026" } });
    fireEvent.blur(to);
    expect(await screen.findByText("Ngày không hợp lệ")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
