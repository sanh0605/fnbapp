import { beforeEach, describe, expect, it, vi } from "vitest";

const getActivityLogEvents = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ getActivityLogEvents }));
vi.mock("./components/ActivityLogClient", () => ({ default: () => null }));

import ActivityLogPage from "./page";

describe("activity log page day window (A2)", () => {
  beforeEach(() => {
    getActivityLogEvents.mockReset();
    getActivityLogEvents.mockResolvedValue({ events: [], actors: [], totalCount: 0, itemsPerPage: 20 });
  });

  it("filtering 15/09/2026 spans Saigon 00:00:00 to 23:59:59.999", async () => {
    await ActivityLogPage({ searchParams: { from: "2026-09-15", to: "2026-09-15" } });
    const arg = getActivityLogEvents.mock.calls[0][0];
    expect(arg.from).toBe("2026-09-14T17:00:00.000Z");
    expect(arg.to).toBe("2026-09-15T16:59:59.999Z");
    const event = new Date("2026-09-14T23:30:00Z").getTime();
    expect(event).toBeGreaterThanOrEqual(new Date(arg.from).getTime());
    expect(event).toBeLessThanOrEqual(new Date(arg.to).getTime());
  });
});
