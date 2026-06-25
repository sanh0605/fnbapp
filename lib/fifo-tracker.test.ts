import { beforeEach, describe, expect, it } from "vitest";
import { FIFOTracker } from "@/lib/fifo-tracker";
import type { LedgerEntry } from "@/lib/fifo-tracker";

describe("FIFOTracker", () => {
  let tracker: FIFOTracker;

  const ledger: LedgerEntry[] = [
    { id: "PO-1", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "100", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    { id: "S-1", item_reference: "MILK", transaction_type: "SALES_CONSUME", unit_cost: "0", quantity_change: "-3", created_at: "2026-06-03T00:00:00Z" },
    { id: "PO-2", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "200", quantity_change: "5", created_at: "2026-06-05T00:00:00Z" },
  ];

  beforeEach(() => {
    tracker = new FIFOTracker();
    tracker.init(ledger);
  });

  it("initializes batches and applies prior sales in chronological order", () => {
    expect(tracker.size()).toBe(2);
    expect(tracker.getRemaining("MILK")).toBe(12);
  });

  it("consumes from oldest remaining batch first", () => {
    const cost = tracker.consume("MILK", 3);
    expect(cost).toBe(300);
    expect(tracker.getRemaining("MILK")).toBe(9);
  });

  it("spans batches after prior sales have reduced older stock", () => {
    const cost = tracker.consume("MILK", 12);
    expect(cost).toBe(7 * 100 + 5 * 200);
    expect(tracker.getRemaining("MILK")).toBe(0);
  });

  it("returns partial cost when insufficient stock", () => {
    const cost = tracker.consume("MILK", 100);
    expect(cost).toBe(7 * 100 + 5 * 200);
    expect(tracker.getRemaining("MILK")).toBe(0);
  });

  it("returns 0 for unknown ingredient", () => {
    expect(tracker.consume("UNKNOWN", 5)).toBe(0);
  });

  it("returns 0 for non-positive qty", () => {
    expect(tracker.consume("MILK", 0)).toBe(0);
    expect(tracker.consume("MILK", -5)).toBe(0);
  });

  it("does not use receipts that happen after an earlier sale", () => {
    const t = new FIFOTracker();
    t.init([
      { id: "PO-1", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "100", quantity_change: "5", created_at: "2026-06-01T00:00:00Z" },
      { id: "S-1", item_reference: "MILK", transaction_type: "SALES_CONSUME", unit_cost: "0", quantity_change: "-8", created_at: "2026-06-02T00:00:00Z" },
      { id: "PO-2", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "200", quantity_change: "10", created_at: "2026-06-03T00:00:00Z" },
    ]);

    expect(t.getRemaining("MILK")).toBe(10);
    expect(t.consume("MILK", 2)).toBe(400);
  });

  it("applies production consumption in chronological order", () => {
    const t = new FIFOTracker();
    t.init([
      { id: "PO-1", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "100", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { id: "P-1", item_reference: "MILK", transaction_type: "PRODUCTION_CONSUME", unit_cost: "0", quantity_change: "-4", created_at: "2026-06-02T00:00:00Z" },
      { id: "PO-2", item_reference: "MILK", transaction_type: "PO_RECEIPT", unit_cost: "200", quantity_change: "10", created_at: "2026-06-03T00:00:00Z" },
    ]);

    expect(t.getRemaining("MILK")).toBe(16);
    expect(t.consume("MILK", 8)).toBe(6 * 100 + 2 * 200);
  });
});
