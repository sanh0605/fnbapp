import { describe, expect, it } from "vitest";
import {
  buildBackdatedEventsGapReport,
  type BackdatedGapLine,
  type HistoricalBackdatedLedgerRow,
} from "./task-3.8-gap-report";

const lines: BackdatedGapLine[] = [
  {
    line_id: "LINE-1",
    order_id: "ORDER-1",
    sale_time: "2026-06-19T00:00:00.000Z",
    stored_cost: 110,
    expected_cost: 100,
    delta_vnd: -10,
    consumed_item_ids: ["ING-1"],
    causal_backdated_ledger_ids: ["LEDGER-1", "LEDGER-2"],
  },
  {
    line_id: "LINE-2",
    order_id: "ORDER-2",
    sale_time: "2026-06-20T00:00:00.000Z",
    stored_cost: 220,
    expected_cost: 200,
    delta_vnd: -20,
    consumed_item_ids: ["ING-1"],
    causal_backdated_ledger_ids: ["LEDGER-1"],
  },
];

const historicalRows: HistoricalBackdatedLedgerRow[] = [
  {
    stock_ledger_id: "LEDGER-1",
    transaction_type: "PO_RECEIPT",
    source_table: "purchase_orders",
    source_id: "PO-1",
    item_reference: "ING-1",
    quantity_change: 100,
    unit_cost: 5,
    effective_timestamp: "2026-06-18T00:00:00.000Z",
    visibility_timestamp: "2026-06-21T00:00:00.000Z",
    detection_method: "SOURCE_CREATED_AT",
    lag_minutes: 4320,
  },
  {
    stock_ledger_id: "LEDGER-2",
    transaction_type: "STOCK_ADJUST",
    source_table: "stock_adjustments",
    source_id: "ADJ-1",
    item_reference: "ING-2",
    quantity_change: -1,
    unit_cost: 0,
    effective_timestamp: "2026-06-18T00:00:00.000Z",
    visibility_timestamp: "2026-06-21T00:00:00.000Z",
    detection_method: "SOURCE_CREATED_AT",
    lag_minutes: 4320,
  },
];

describe("buildBackdatedEventsGapReport", () => {
  it("keeps overlapping ledger totals non-additive and preserves unique cohort delta", () => {
    const report = buildBackdatedEventsGapReport({
      lines,
      historicalRows,
      durableEvents: [],
      liveLedgerRows: [],
      sourceHeaders: [],
    });

    expect(report.population).toMatchObject({
      line_count: 2,
      unique_delta_vnd: -30,
      historical_ledger_row_count: 2,
      lines_with_multiple_ledger_rows: 1,
      durable_event_count: 0,
      lines_with_durable_event: 0,
    });
    expect(report.ledger_rows[0]).toMatchObject({
      stock_ledger_id: "LEDGER-1",
      affected_line_count: 2,
      affected_line_total_delta_vnd: -30,
      delta_is_additive_across_ledger_rows: false,
      availability_heuristic: "LIKELY_AVAILABLE",
      operator_decision: "UNSET",
    });
    expect(report.ledger_rows[1]).toMatchObject({
      stock_ledger_id: "LEDGER-2",
      affected_line_count: 1,
      affected_line_total_delta_vnd: -10,
      availability_heuristic: "UNDETERMINED",
    });
  });

  it("maps durable events by ledger id and validates documented statuses", () => {
    const report = buildBackdatedEventsGapReport({
      lines: [lines[1]],
      historicalRows: [historicalRows[0]],
      durableEvents: [{
        id: "EVENT-1",
        stock_ledger_id: "LEDGER-1",
        status: "RECOMPUTED",
        source_table: "purchase_orders",
        source_id: "PO-1",
        item_reference: "ING-1",
        quantity_change: 100,
        unit_cost: 5,
        effective_timestamp: "2026-06-18T00:00:00.000Z",
        visibility_timestamp: "2026-06-21T00:00:00.000Z",
        detected_at: "2026-06-21T00:01:00.000Z",
      }],
      liveLedgerRows: [],
      sourceHeaders: [],
    });

    expect(report.lines[0].associated_event_ids).toEqual(["EVENT-1"]);
    expect(report.status_breakdown).toEqual([
      { status: "RECOMPUTED", event_count: 1, affected_line_count: 1, affected_line_total_delta_vnd: -20 },
    ]);
    expect(report.validation.unexpected_event_statuses).toEqual([]);
  });
});
