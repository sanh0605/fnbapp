export type BackdatedGapLine = {
  line_id: string;
  order_id: string;
  order_no?: string;
  sale_time: string;
  product_id?: string;
  variant_id?: string;
  stored_cost: number;
  expected_cost: number;
  delta_vnd: number;
  consumed_item_ids: string[];
  causal_backdated_ledger_ids: string[];
};

export type HistoricalBackdatedLedgerRow = {
  stock_ledger_id: string;
  transaction_type: string;
  source_table: string;
  source_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  effective_timestamp: string;
  visibility_timestamp: string;
  detection_method: string;
  lag_minutes: number;
};

export type DurableBackdatedEvent = {
  id: string;
  stock_ledger_id: string;
  status: string;
  source_table: string;
  source_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  effective_timestamp: string;
  visibility_timestamp: string;
  detected_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  recompute_run_id?: string | null;
  notes?: string | null;
};

export type LiveLedgerRow = {
  id: string;
  created_at?: string | null;
  transaction_type?: string | null;
  reference_id?: string | null;
  item_reference?: string | null;
  quantity_change?: number | string | null;
  unit_cost?: number | string | null;
};

export type SourceHeader = {
  id: string;
  created_at?: string | null;
};

type GapReportInput = {
  lines: BackdatedGapLine[];
  historicalRows: HistoricalBackdatedLedgerRow[];
  durableEvents: DurableBackdatedEvent[];
  liveLedgerRows: LiveLedgerRow[];
  sourceHeaders: SourceHeader[];
};

const EXPECTED_STATUSES = ["PENDING", "APPROVED", "RECOMPUTED", "REJECTED"] as const;

export function buildBackdatedEventsGapReport(input: GapReportInput) {
  const lines = [...input.lines].sort((left, right) => left.line_id.localeCompare(right.line_id));
  const historicalById = new Map(input.historicalRows.map(row => [row.stock_ledger_id, row]));
  const liveLedgerById = new Map(input.liveLedgerRows.map(row => [row.id, row]));
  const sourceHeaderById = new Map(input.sourceHeaders.map(row => [row.id, row]));
  const eventsByLedgerId = groupBy(input.durableEvents, row => row.stock_ledger_id);
  const causalLedgerIds = unique(lines.flatMap(line => line.causal_backdated_ledger_ids));

  const reportLines = lines.map(line => {
    const events = unique(line.causal_backdated_ledger_ids.flatMap(id =>
      (eventsByLedgerId.get(id) || []).map(event => event.id),
    ));
    return {
      ...line,
      causal_backdated_ledger_ids: unique(line.causal_backdated_ledger_ids),
      associated_event_ids: events,
      durable_event_coverage: events.length > 0 ? "COVERED" : "HISTORICAL_GAP",
    };
  });

  const ledgerRows = causalLedgerIds.map(stockLedgerId => {
    const historical = historicalById.get(stockLedgerId);
    if (!historical) return null;
    const affectedLines = reportLines.filter(line => line.causal_backdated_ledger_ids.includes(stockLedgerId));
    const liveLedger = liveLedgerById.get(stockLedgerId);
    const sourceHeader = sourceHeaderById.get(historical.source_id);
    const heuristic = availabilityHeuristic(historical, affectedLines);
    const events = eventsByLedgerId.get(stockLedgerId) || [];
    const effectiveMs = timestampMs(historical.effective_timestamp);
    const createdMs = timestampMs(historical.visibility_timestamp);

    return {
      stock_ledger_id: stockLedgerId,
      transaction_type: historical.transaction_type,
      source_table: historical.source_table,
      source_id: historical.source_id,
      item_reference: historical.item_reference,
      quantity_change: historical.quantity_change,
      unit_cost: historical.unit_cost,
      effective_at: historical.effective_timestamp,
      created_at: historical.visibility_timestamp,
      created_at_semantics: "Source header created_at used as the Task 3.2 visibility timestamp",
      lag_ms: createdMs - effectiveMs,
      lag_minutes: historical.lag_minutes,
      affected_line_ids: affectedLines.map(line => line.line_id),
      affected_line_count: affectedLines.length,
      affected_line_total_delta_vnd: sum(affectedLines.map(line => line.delta_vnd)),
      delta_is_additive_across_ledger_rows: false,
      durable_event_ids: events.map(event => event.id).sort(),
      durable_event_statuses: unique(events.map(event => event.status)),
      availability_heuristic: heuristic.value,
      availability_heuristic_reason: heuristic.reason,
      heuristic_is_operator_decision: false,
      operator_decision: "UNSET",
      operator_notes: "",
      live_validation: {
        stock_ledger_row_found: Boolean(liveLedger),
        stock_ledger_created_at: liveLedger?.created_at || null,
        source_header_found: Boolean(sourceHeader),
        source_header_created_at: sourceHeader?.created_at || null,
        stock_ledger_effective_at_matches: liveLedger?.created_at
          ? sameTimestamp(liveLedger.created_at, historical.effective_timestamp)
          : null,
        source_created_at_matches_visibility: sourceHeader?.created_at
          ? sameTimestamp(sourceHeader.created_at, historical.visibility_timestamp)
          : null,
      },
    };
  }).filter(nonNullable);

  const durableEvents = [...input.durableEvents]
    .filter(event => causalLedgerIds.includes(event.stock_ledger_id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(event => {
      const affectedLines = reportLines.filter(line => line.associated_event_ids.includes(event.id));
      return {
        ...event,
        lag_ms: timestampMs(event.visibility_timestamp) - timestampMs(event.effective_timestamp),
        affected_line_ids: affectedLines.map(line => line.line_id),
        affected_line_count: affectedLines.length,
        affected_line_total_delta_vnd: sum(affectedLines.map(line => line.delta_vnd)),
      };
    });

  const statuses = unique(durableEvents.map(event => event.status));
  const statusBreakdown = statuses.map(status => {
    const statusEvents = durableEvents.filter(event => event.status === status);
    const lineIds = unique(statusEvents.flatMap(event => event.affected_line_ids));
    const statusLines = reportLines.filter(line => lineIds.includes(line.line_id));
    return {
      status,
      event_count: statusEvents.length,
      affected_line_count: statusLines.length,
      affected_line_total_delta_vnd: sum(statusLines.map(line => line.delta_vnd)),
    };
  });

  const linesWithEvent = reportLines.filter(line => line.associated_event_ids.length > 0);
  const missingHistoricalLedgerIds = causalLedgerIds.filter(id => !historicalById.has(id));
  const unexpectedStatuses = unique(durableEvents
    .map(event => event.status)
    .filter(status => !EXPECTED_STATUSES.includes(status as typeof EXPECTED_STATUSES[number])));

  return {
    population: {
      line_count: reportLines.length,
      unique_delta_vnd: sum(reportLines.map(line => line.delta_vnd)),
      historical_ledger_row_count: ledgerRows.length,
      lines_with_multiple_ledger_rows: reportLines.filter(line => line.causal_backdated_ledger_ids.length > 1).length,
      durable_event_count: durableEvents.length,
      lines_with_durable_event: linesWithEvent.length,
      lines_without_durable_event: reportLines.length - linesWithEvent.length,
    },
    definitions: {
      historical_gap: "A Task 3.2 precise historical fingerprint has no migration-0014 durable backdated_ledger_events row because the trigger was not backfilled.",
      affected_line_total_delta_vnd: "Full delta of every affected line for this ledger row. Values overlap when a line maps to multiple rows and must not be summed across rows.",
      likely_available: "Heuristic only: a positive-cost PO receipt became effective before mapped sales, its source header was created later, and every mapped line consumed the received item inside that window.",
    },
    lines: reportLines,
    ledger_rows: ledgerRows,
    durable_events: durableEvents,
    status_breakdown: statusBreakdown,
    validation: {
      expected_line_count: 41,
      expected_unique_delta_vnd: -43809,
      expected_historical_ledger_row_count: 5,
      missing_historical_ledger_ids: missingHistoricalLedgerIds,
      unexpected_event_statuses: unexpectedStatuses,
      every_line_has_historical_ledger_row: reportLines.every(line =>
        line.causal_backdated_ledger_ids.length > 0
        && line.causal_backdated_ledger_ids.every(id => historicalById.has(id)),
      ),
      every_line_has_durable_event: reportLines.every(line => line.associated_event_ids.length > 0),
      live_stock_ledger_rows_found: ledgerRows.filter(row => row.live_validation.stock_ledger_row_found).length,
      live_source_headers_found: ledgerRows.filter(row => row.live_validation.source_header_found).length,
    },
  };
}

function availabilityHeuristic(
  row: HistoricalBackdatedLedgerRow,
  lines: BackdatedGapLine[],
): { value: "LIKELY_AVAILABLE" | "UNDETERMINED"; reason: string } {
  const precisePositivePoReceipt = row.transaction_type === "PO_RECEIPT"
    && row.source_table === "purchase_orders"
    && row.detection_method === "SOURCE_CREATED_AT"
    && row.quantity_change > 0
    && row.unit_cost > 0;
  const everyLineInsideWindow = lines.length > 0 && lines.every(line => {
    const saleMs = timestampMs(line.sale_time);
    return saleMs >= timestampMs(row.effective_timestamp)
      && saleMs <= timestampMs(row.visibility_timestamp)
      && line.consumed_item_ids.includes(row.item_reference);
  });
  if (precisePositivePoReceipt && everyLineInsideWindow) {
    return {
      value: "LIKELY_AVAILABLE",
      reason: "Positive-cost PO receipt; all mapped sales fall between effective_at and source created_at and consume this item.",
    };
  }
  return {
    value: "UNDETERMINED",
    reason: "The evidence does not satisfy every conservative PO/window/item condition; operator evidence is required.",
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    groups.set(value, [...(groups.get(value) || []), row]);
  }
  return groups;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function timestampMs(value: string): number {
  return new Date(value).getTime();
}

function sameTimestamp(left: string, right: string): boolean {
  return timestampMs(left) === timestampMs(right);
}

function nonNullable<T>(value: T | null): value is T {
  return value !== null;
}
