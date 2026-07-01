import { describe, expect, it } from "vitest";
import { buildPriceHistoryTimeline } from "@/lib/price-history";

describe("buildPriceHistoryTimeline", () => {
  it("sorts by effective time and derives validity windows", () => {
    const timeline = buildPriceHistoryTimeline([
      {
        id: "PPH-OLD",
        variant_id: "VAR-001",
        old_price: null,
        new_price: 35000,
        effective_at: "2026-06-01T00:00:00.000Z",
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "PPH-NEW",
        variant_id: "VAR-001",
        old_price: 35000,
        new_price: 40000,
        effective_at: "2026-07-01T00:00:00.000Z",
        created_at: "2026-07-01T00:00:00.000Z",
      },
    ]);

    expect(timeline).toEqual([
      expect.objectContaining({
        id: "PPH-NEW",
        newPrice: 40000,
        effectiveAt: "2026-07-01T00:00:00.000Z",
        endAt: null,
        isCurrent: true,
      }),
      expect.objectContaining({
        id: "PPH-OLD",
        newPrice: 35000,
        effectiveAt: "2026-06-01T00:00:00.000Z",
        endAt: "2026-07-01T00:00:00.000Z",
        isCurrent: false,
      }),
    ]);
  });

  it("preserves a zero price so migration corruption remains visible", () => {
    const timeline = buildPriceHistoryTimeline([
      {
        id: "PPH-001",
        variant_id: "VAR-001",
        old_price: null,
        new_price: 0,
        effective_at: "2026-06-28T00:00:00.000Z",
        created_at: "2026-03-26T00:00:00.000Z",
      },
    ]);

    expect(timeline[0].newPrice).toBe(0);
  });
});
