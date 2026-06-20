import { describe, it, expect, beforeEach } from "vitest";
import { FIFOTracker } from "@/lib/fifo-tracker";
import type { LedgerEntry } from "@/lib/fifo-tracker";

describe("FIFOTracker", () => {
  let tracker: FIFOTracker;

  const ledger: LedgerEntry[] = [
    { id: "PO-1", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "100", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    { id: "PO-2", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "200", quantity_change: "5", created_at: "2026-06-05T00:00:00Z" },
    // Sales don't affect FIFO initialization
    { id: "S-1", item_reference: "MILK", transaction_type: "SALES_CONSUME", unit_cost: "0", quantity_change: "-3", created_at: "2026-06-03T00:00:00Z" },
  ];

  beforeEach(() => {
    tracker = new FIFOTracker();
    tracker.init(ledger);
  });

  it("initializes batches in chronological order", () => {
    expect(tracker.size()).toBe(2); // 2 MILK batches, sales ignored
    expect(tracker.getRemaining("MILK")).toBe(15); // 10 + 5
  });

  it("consumes from oldest batch first", () => {
    // Consume 3 units — all from PO-1 (10 units @ 100/u)
    const cost = tracker.consume("MILK", 3);
    expect(cost).toBe(300); // 3 × 100
    expect(tracker.getRemaining("MILK")).toBe(12); // 15 - 3
  });

  it("spans batches when consuming more than oldest has", () => {
    // Consume 12 units: 10 from PO-1 (100/u) + 2 from PO-2 (200/u)
    const cost = tracker.consume("MILK", 12);
    expect(cost).toBe(10 * 100 + 2 * 200); // 1000 + 400 = 1400
    expect(tracker.getRemaining("MILK")).toBe(3); // 15 - 12
  });

  it("returns partial cost when insufficient stock", () => {
    // Try to consume 100 units, only 15 available
    const cost = tracker.consume("MILK", 100);
    expect(cost).toBe(10 * 100 + 5 * 200); // 1000 + 1000 = 2000
    expect(tracker.getRemaining("MILK")).toBe(0);
  });

  it("returns 0 for unknown ingredient", () => {
    expect(tracker.consume("UNKNOWN", 5)).toBe(0);
  });

  it("returns 0 for non-positive qty", () => {
    expect(tracker.consume("MILK", 0)).toBe(0);
    expect(tracker.consume("MILK", -5)).toBe(0);
  });

  it("sequential consumption simulates real FIFO flow", () => {
    // Order 1: consume 8 (all from PO-1: 8 × 100 = 800)
    const cost1 = tracker.consume("MILK", 8);
    expect(cost1).toBe(800);

    // Order 2: consume 5 (2 left from PO-1 + 3 from PO-2)
    // = 2 × 100 + 3 × 200 = 200 + 600 = 800
    const cost2 = tracker.consume("MILK", 5);
    expect(cost2).toBe(800);

    // Order 3: consume 2 (only 2 left from PO-2)
    // = 2 × 200 = 400
    const cost3 = tracker.consume("MILK", 2);
    expect(cost3).toBe(400);

    expect(tracker.getRemaining("MILK")).toBe(0);
  });
});
