import { displayMoney } from "@/lib/reports/display-rounding";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { toSaigonUtcRange } from "@/lib/shared/report-time";
import {
  activeSlipLines, reversedIssueIds, slipCancellation, slipLines,
  type IssueRowRecord, type IssueSlipRecord,
} from "./issue-slip-status";

// Issue-slip list (BR-INV-012): the slips staff wrote. Stocktake rows live on
// the Kiểm kê page, not here (BR-INV-022). Search/date/paging follow the shared
// slip-list template (lib/purchasing/purchase-order-list.ts).
export const ISSUE_SLIPS_PER_PAGE = 20;
const MAX_QUERY_LENGTH = 100;
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NO_NAME = "—";

export type IssueSlipKind = "SLIP" | "CANCELLED";
export interface IssueSlipListFilters { q?: string; kind?: string; person?: string; from?: string; to?: string; page?: string }
export interface IssueSlipListRow {
  id: string; href: string; kind: IssueSlipKind; dateText: string;
  createdByName: string; value: number;
}
export interface IssueSlipListPage {
  rows: IssueSlipListRow[]; total: number; page: number; pageCount: number;
  firstIndex: number; lastIndex: number; rangeError: boolean; people: string[];
  // BR-UI-004: value total over every matched row (all pages), rounded once from
  // the exact sum (BR-DATA-005). Cancelled slips never count (BR-ACCESS-003).
  totals: { count: number; value: number };
}

interface Candidate {
  row: IssueSlipListRow; exactValue: number; timeMs: number; createdMs: number; haystack: string;
}

function ms(value: string | null | undefined): number {
  const t = new Date(value || "").getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function listIssueSlipsPage(input: {
  slips: IssueSlipRecord[]; issues: IssueRowRecord[];
  items: { id: string; name: string }[]; lineValues: Map<string, number>; filters: IssueSlipListFilters;
}): IssueSlipListPage {
  const { slips, issues, lineValues, filters } = input;
  const itemName = new Map(input.items.map(i => [i.id, i.name]));
  const reversed = reversedIssueIds(issues);
  const sumValues = (lines: IssueRowRecord[]) =>
    lines.reduce((s, l) => s + (lineValues.get(l.id) ?? 0), 0);
  const namesOf = (lines: IssueRowRecord[]) =>
    lines.map(l => itemName.get(l.purchased_item_id) ?? "").join(" ");

  const candidates: Candidate[] = [];

  for (const slip of slips) {
    const cancelled = slipCancellation(slip.id, issues, reversed) !== null;
    const exactValue = cancelled ? 0 : sumValues(activeSlipLines(slip.id, issues, reversed));
    const value = displayMoney(exactValue);
    candidates.push({
      row: {
        id: slip.id, href: `/admin/inventory/issue-slips/${slip.id}`,
        kind: cancelled ? "CANCELLED" : "SLIP",
        dateText: formatDateTimeFull(slip.issued_at), createdByName: slip.created_by_name ?? NO_NAME, value,
      },
      exactValue,
      timeMs: ms(slip.issued_at), createdMs: ms(slip.created_at),
      haystack: `${slip.id} ${namesOf(slipLines(slip.id, issues))}`.toLowerCase(),
    });
  }

  const people = [...new Set(candidates.map(c => c.row.createdByName).filter(n => n !== NO_NAME))]
    .sort((a, b) => a.localeCompare(b, "vi"));

  const term = (filters.q ?? "").trim().slice(0, MAX_QUERY_LENGTH).toLowerCase();
  const from = filters.from && DAY_ONLY.test(filters.from) ? filters.from : undefined;
  const to = filters.to && DAY_ONLY.test(filters.to) ? filters.to : undefined;
  const rangeError = Boolean(from && to && from > to);
  const range = rangeError ? null : toSaigonUtcRange(from ?? "1970-01-01", to ?? "9999-12-31");
  const startMs = from && range ? range.startUtc.getTime() : -Infinity;
  const endMs = to && range ? range.endUtc.getTime() : Infinity;
  const kind = filters.kind === "SLIP" || filters.kind === "CANCELLED" ? filters.kind : null;

  const matched = candidates.filter(c => {
    if (kind ? c.row.kind !== kind : c.row.kind === "CANCELLED") return false;
    if (filters.person && filters.person !== "ALL" && c.row.createdByName !== filters.person) return false;
    if (c.timeMs < startMs || c.timeMs > endMs) return false;
    return !term || c.haystack.includes(term);
  });

  matched.sort((a, b) =>
    b.timeMs - a.timeMs || b.createdMs - a.createdMs || b.row.id.localeCompare(a.row.id));

  const total = matched.length;
  const counted = matched.filter(c => c.row.kind !== "CANCELLED");
  const totals = {
    count: counted.length,
    value: displayMoney(counted.reduce((sum, c) => sum + c.exactValue, 0)),
  };
  const pageCount = Math.max(1, Math.ceil(total / ISSUE_SLIPS_PER_PAGE));
  const asked = Number(filters.page);
  const page = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, pageCount) : 1;
  const start = (page - 1) * ISSUE_SLIPS_PER_PAGE;
  const slice = matched.slice(start, start + ISSUE_SLIPS_PER_PAGE);

  return {
    rows: slice.map(c => c.row), total, page, pageCount,
    firstIndex: total === 0 ? 0 : start + 1, lastIndex: start + slice.length, rangeError, people, totals,
  };
}
