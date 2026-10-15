import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getIssueSlipsPage = vi.hoisted(() => vi.fn());
const IssueSlipsClient = vi.hoisted(() => () => null);
vi.mock("./actions", () => ({ getIssueSlipsPage }));
vi.mock("./components/IssueSlipsClient", () => ({ default: IssueSlipsClient }));

import IssueSlipsPage from "./page";

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

describe("issue slips page time filter (BR-UI-007)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
    getIssueSlipsPage.mockReset();
    getIssueSlipsPage.mockResolvedValue({ rows: [], total: 0, page: 1, pageCount: 1, firstIndex: 0, lastIndex: 0, rangeError: false, people: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("opens on Tháng này", async () => {
    const tree = await IssueSlipsPage({ searchParams: Promise.resolve({}) });
    const arg = getIssueSlipsPage.mock.calls[0][0];
    expect(arg.from).toBe("2026-10-01");
    expect(arg.to).toBe("2026-10-31");
    const props = propsOf(tree, IssueSlipsClient);
    expect(props.range).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
    expect(props.today).toBe("2026-10-09");
    expect(props.searching).toBe(false);
  });

  it("a typed code from September is searched on every day, other filters still apply", async () => {
    const tree = await IssueSlipsPage({ searchParams: Promise.resolve({ q: "ISL-00053", kind: "MANUAL" }) });
    const arg = getIssueSlipsPage.mock.calls[0][0];
    expect(arg.from).toBeUndefined();
    expect(arg.to).toBeUndefined();
    expect(arg.q).toBe("ISL-00053");
    expect(arg.kind).toBe("MANUAL");
    expect(propsOf(tree, IssueSlipsClient).searching).toBe(true);
  });
});
