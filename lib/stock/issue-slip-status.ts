// Issue-slip state is derived, not stored (BR-INV-012, BR-INV-013): a slip is
// cancelled when every one of its lines has been returned to stock, and locked
// when it is dated on or before the latest confirmed stocktake.
export interface IssueRowRecord {
  id: string; purchased_item_id: string; issued_at: string; base_quantity: number | string;
  source: string; session_id: string | null; note: string | null; created_at?: string | null;
  reverses_issue_id: string | null; issue_slip_id: string | null;
}
export interface IssueSlipRecord {
  id: string; issued_at: string; note: string | null; created_by_id: string | null;
  created_by_name: string | null; created_at: string | null;
}
export interface StocktakeSessionRecord {
  id: string; status: string; confirmed_at: string | null; confirmed_by_name: string | null;
}
export interface SlipCancellation { at: string; reason: string }
export interface StocktakeLock { sessionId: string; confirmedAt: string }

const CANCEL_NOTE = /Huỷ cả phiếu ISL-\d+ -- ([\s\S]*)$/.source.normalize("NFC");
const CANCEL_PATTERN = new RegExp(CANCEL_NOTE);

/** Ids of lines that another line points back to as its return. */
export function reversedIssueIds(issues: IssueRowRecord[]): Set<string> {
  const out = new Set<string>();
  for (const i of issues) if (i.reverses_issue_id) out.add(i.reverses_issue_id);
  return out;
}

/** Every original line of the slip, returned or not. */
export function slipLines(slipId: string, issues: IssueRowRecord[]): IssueRowRecord[] {
  return issues.filter(i => i.issue_slip_id === slipId);
}

/** Lines of the slip that have not been returned to stock. */
export function activeSlipLines(slipId: string, issues: IssueRowRecord[], reversed: Set<string>): IssueRowRecord[] {
  return slipLines(slipId, issues).filter(i => !reversed.has(i.id));
}

export function parseCancelReason(note: string | null): string {
  if (!note) return "";
  const m = CANCEL_PATTERN.exec(note.normalize("NFC"));
  return m ? m[1].trim() : "";
}

export function slipCancellation(slipId: string, issues: IssueRowRecord[], reversed: Set<string>): SlipCancellation | null {
  const lines = slipLines(slipId, issues);
  if (lines.length === 0) return null;
  if (lines.some(l => !reversed.has(l.id))) return null;
  const ids = new Set(lines.map(l => l.id));
  let best: IssueRowRecord | null = null;
  let bestMs = -Infinity;
  for (const i of issues) {
    if (!i.reverses_issue_id || !ids.has(i.reverses_issue_id)) continue;
    const ms = new Date(i.issued_at).getTime();
    if (best === null || ms > bestMs) { best = i; bestMs = ms; }
  }
  if (!best) return null;
  return { at: best.issued_at, reason: parseCancelReason(best.note) };
}

export function stocktakeLock(issuedAt: string, sessions: StocktakeSessionRecord[]): StocktakeLock | null {
  let latest: StocktakeSessionRecord | null = null;
  let latestMs = -Infinity;
  for (const s of sessions) {
    if (s.status !== "CONFIRMED" || !s.confirmed_at) continue;
    const ms = new Date(s.confirmed_at).getTime();
    if (Number.isNaN(ms)) continue;
    if (latest === null || ms > latestMs) { latest = s; latestMs = ms; }
  }
  if (!latest || !latest.confirmed_at) return null;
  return new Date(issuedAt).getTime() <= latestMs ? { sessionId: latest.id, confirmedAt: latest.confirmed_at } : null;
}
