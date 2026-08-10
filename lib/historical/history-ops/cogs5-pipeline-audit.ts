export type Cogs5AuditEvent = {
  id: string;
  notes?: string | null;
};

export type Cogs5AuditChange = {
  run_id: string;
  row_id: string;
  applied_at: string;
};

export type Cogs5PriorWriteClassification = {
  cogs5EventCount: number;
  cogs5TargetLineCount: number;
  priorWriteLineCount: number;
  task39HistoricalGapLineCount: number;
  backdatedEventLineCount: number;
  otherPriorWriteLineCount: number;
  priorRunIds: string[];
};

const COGS5_NOTE_MARKER = "COGS-5 full-system cost correction";
const TASK39_RUN_ID = "task-3.9-historical-gap-recovery-2026-07-21";

export function classifyCogs5PriorWrites(input: {
  events: Cogs5AuditEvent[];
  changes: Cogs5AuditChange[];
}): Cogs5PriorWriteClassification {
  const eventIds = new Set(input.events.map(event => event.id));
  const cogs5EventIds = new Set(
    input.events
      .filter(event => String(event.notes || "").includes(COGS5_NOTE_MARKER))
      .map(event => event.id),
  );
  const cogs5RunIds = new Set([...cogs5EventIds].map(eventId => `backdated-${eventId}`));
  const cogs5Changes = input.changes.filter(change => cogs5RunIds.has(change.run_id));
  const cogs5AppliedAtByLine = new Map<string, number>();
  for (const change of cogs5Changes) {
    const appliedAtMs = timestampMs(change.applied_at);
    const existing = cogs5AppliedAtByLine.get(change.row_id);
    if (existing === undefined || appliedAtMs < existing) {
      cogs5AppliedAtByLine.set(change.row_id, appliedAtMs);
    }
  }

  const priorRunIds = new Set<string>();
  const priorWriteLines = new Set<string>();
  const task39Lines = new Set<string>();
  const backdatedEventLines = new Set<string>();
  const otherPriorWriteLines = new Set<string>();

  for (const change of input.changes) {
    const cogs5AppliedAtMs = cogs5AppliedAtByLine.get(change.row_id);
    if (cogs5AppliedAtMs === undefined || cogs5RunIds.has(change.run_id)) continue;
    if (timestampMs(change.applied_at) >= cogs5AppliedAtMs) continue;

    priorRunIds.add(change.run_id);
    priorWriteLines.add(change.row_id);
    if (change.run_id === TASK39_RUN_ID) {
      task39Lines.add(change.row_id);
      continue;
    }

    const eventId = change.run_id.startsWith("backdated-")
      ? change.run_id.slice("backdated-".length)
      : "";
    if (eventId && eventIds.has(eventId)) {
      backdatedEventLines.add(change.row_id);
    } else {
      otherPriorWriteLines.add(change.row_id);
    }
  }

  return {
    cogs5EventCount: cogs5EventIds.size,
    cogs5TargetLineCount: cogs5AppliedAtByLine.size,
    priorWriteLineCount: priorWriteLines.size,
    task39HistoricalGapLineCount: task39Lines.size,
    backdatedEventLineCount: backdatedEventLines.size,
    otherPriorWriteLineCount: otherPriorWriteLines.size,
    priorRunIds: [...priorRunIds].sort(),
  };
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}
