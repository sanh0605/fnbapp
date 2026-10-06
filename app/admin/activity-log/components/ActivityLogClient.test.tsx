// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import ActivityLogClient from "./ActivityLogClient";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
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
