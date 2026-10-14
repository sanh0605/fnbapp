import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getActivityLogEvents = vi.hoisted(() => vi.fn());
const ActivityLogClient = vi.hoisted(() => () => null);
vi.mock("./actions", () => ({ getActivityLogEvents }));
vi.mock("./components/ActivityLogClient", () => ({ default: ActivityLogClient }));

import ActivityLogPage from "./page";

// Server pages return a JSX tree; find the client element's props without rendering it.
function propsOf(tree: any, type: unknown): any {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree.props;
  const kids = tree.props?.children;
  for (const k of Array.isArray(kids) ? kids : [kids]) {
    const hit = propsOf(k, type);
    if (hit) return hit;
  }
  return undefined;
}

describe("activity log page time filter (BR-UI-007)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
    getActivityLogEvents.mockReset();
    getActivityLogEvents.mockResolvedValue({ events: [], actors: [], totalCount: 0, itemsPerPage: 20 });
  });
  afterEach(() => vi.useRealTimers());

  it("opens on Tháng này: whole Saigon days", async () => {
    const tree = await ActivityLogPage({ searchParams: {} });
    const arg = getActivityLogEvents.mock.calls[0][0];
    expect(arg.from).toBe("2026-09-30T17:00:00.000Z");
    expect(arg.to).toBe("2026-10-31T16:59:59.999Z");
    expect(propsOf(tree, ActivityLogClient).range.preset).toBe("THIS_MONTH");
  });

  it("a typed word is searched on every day", async () => {
    const tree = await ActivityLogPage({ searchParams: { q: "Huỷ", type: "ORDER" } });
    const arg = getActivityLogEvents.mock.calls[0][0];
    expect(arg.from).toBeUndefined();
    expect(arg.to).toBeUndefined();
    expect(arg.type).toBe("ORDER");
    expect(propsOf(tree, ActivityLogClient).searching).toBe(true);
  });
});
