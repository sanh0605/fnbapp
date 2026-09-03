import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSalesDataV2: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../actions", () => ({ getSalesDataV2: mocks.getSalesDataV2 }));

import { getDailyDigest } from "./actions";

const EMPTY_SALES = {
  totalRevenue: 0,
  totalOrders: 0,
  avgOrderValue: 0,
  bestSellers: [],
  paymentBreakdown: [],
};

describe("getDailyDigest -- default date (section 7, OPEN-ITEMS 64)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.getSalesDataV2.mockResolvedValue(EMPTY_SALES);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // `new Date().toISOString().slice(0, 10)` reads the UTC calendar day.
  // Just after Saigon midnight (00:30) is still 17:30 the PREVIOUS day in
  // UTC -- the digest would silently open yesterday's report between 00:00
  // and 07:00 Saigon, every day, with no error and no visible sign on
  // screen (section 7: it feeds getDigestDateOffsets, so yesterday and
  // last-week shift together and the comparison still looks internally
  // consistent). Picked 2026-06-01 specifically so a wrong answer reads as
  // an obviously wrong date, not an off-by-one nobody would notice.
  it("opens today's (Saigon) report, not yesterday's, just after Saigon midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T17:30:00.000Z")); // 2026-06-01T00:30 Saigon

    const result = await getDailyDigest();

    expect(result.date).toBe("2026-06-01");
  });
});
