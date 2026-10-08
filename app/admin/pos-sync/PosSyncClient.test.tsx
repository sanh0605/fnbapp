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

    // Wave K6: each row also shows as a phone card, so count inside the
    // computer tables only (one time per table).
    const inTables = screen
      .getAllByText((_, el) => el?.tagName === "TD" && el.textContent === "15/09/2026 06:30:00");
    expect(inTables).toHaveLength(2);
  });
});

// Wave K6: the two lists use the shared Table on a computer and become cards
// on a phone (.claude/rules/ui-devices.md); "Đã xử lý" is a shared button.
describe("PosSyncClient on the shared templates (wave K6)", () => {
  const FAILURE = { id: "F1", request_token: "REQ-001", error_message: "Network error", occurred_at: "2026-09-14T23:30:00Z" };
  const LATE = { id: "O1", order_no: "ORD-001", created_at: "2026-09-14T23:30:00Z", synced_at: "2026-09-14T23:45:00Z", delayMinutes: 15 };

  it("each list has a phone card carrying its code; the failure card has an Đã xử lý button", () => {
    const { container } = render(<PosSyncClient failures={[FAILURE]} lateOrders={[LATE]} />);
    const phoneLists = Array.from(container.querySelectorAll(".md\\:hidden"));
    expect(phoneLists).toHaveLength(2);
    expect(phoneLists[0].textContent).toContain("REQ-001");
    expect(phoneLists[0].querySelector("button")?.textContent).toBe("Đã xử lý");
    expect(phoneLists[1].textContent).toContain("ORD-001");
    expect(phoneLists[1].textContent).toContain("15 phút");
  });

  it("the computer tables are the shared Table, inside a box hidden on a phone", () => {
    const { container } = render(<PosSyncClient failures={[FAILURE]} lateOrders={[LATE]} />);
    const tables = Array.from(container.querySelectorAll("table"));
    expect(tables).toHaveLength(2);
    for (const t of tables) {
      expect(t.closest(".md\\:block")?.className).toContain("hidden");
      expect(t.querySelector("thead th")?.className).toContain("text-text-secondary");
    }
  });
});
