// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PosSyncClient } from "./PosSyncClient";

vi.mock("./actions", () => ({
  resolvePosSyncFailure: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PosSyncClient", () => {
  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z: shows 15/09/2026 06:30:00", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));

    render(
      <PosSyncClient
        failures={[
          {
            id: "F1",
            request_token: "REQ-001",
            error_message: "Network error",
            occurred_at: "2026-09-14T23:30:00Z",
          },
        ]}
        lateOrders={[
          {
            id: "O1",
            order_no: "ORD-001",
            created_at: "2026-09-14T23:30:00Z",
            synced_at: "2026-09-14T23:45:00Z",
            delayMinutes: 15,
          },
        ]}
      />
    );

    const matches = screen.getAllByText("15/09/2026 06:30:00");
    expect(matches).toHaveLength(2);
  });
});
