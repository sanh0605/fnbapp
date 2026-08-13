import { computeIssueCosting, type Purchase, type Issue } from "@/lib/issue-costing";
import { buildIssueCostingIssues } from "@/lib/issue-costing-inputs";

// Plan G. Split out of app/admin/reports/issued/actions.ts (not defined
// there) because that file is "use server" -- every export from a "use
// server" file must be an async server action, and CLAUDE.md section 9
// already records a real incident where a synchronous export from such a
// file passed every other gate and only broke `npm run build`. These are
// plain synchronous functions, so they live here; the exact (pre-rounding)
// values they return are also what makes the section 5 sum gate testable
// without going through the action's own display rounding.

export type IssuedItemFigure = {
  purchasedItemId: string;
  issuedQuantity: number;
  issuedValueExact: number;
  closingValueExact: number;
};

export function computeIssuedItemFigures(purchases: Purchase[], allIssues: Issue[]): IssuedItemFigure[] {
  return computeIssueCosting(purchases, allIssues).map(r => ({
    purchasedItemId: r.purchased_item_id,
    issuedQuantity: r.issued_quantity,
    issuedValueExact: r.issued_value,
    closingValueExact: r.closing_value,
  }));
}

export type IssuedEventFigure = {
  key: string;
  kind: "STOCKTAKE" | "MANUAL";
  label: string;
  at: string;
  itemCount: number;
  valueExact: number;
};

// Tab "Theo lần xuất": computeIssueCosting returns per-item cumulative
// totals, not a value per stocktake session or issue slip -- Plan G section
// 5 forbids inventing a second cost definition (e.g. quantity times a unit
// cost derived some other way) to get one.
//
// The only correct derivation is prefix subtraction using the SAME engine,
// grouped by real foreign keys rather than by time window: every STOCKTAKE
// row carries session_id (required by the confirm-session RPC, never null in
// practice), every MANUAL row carries issue_slip_id (required by the
// multi-line slip RPC). Order the groups by their own representative
// timestamp (every row in one group shares the exact same issued_at, since
// one RPC call writes a whole session or a whole slip at once), then replay
// computeIssueCosting over a growing set of full groups -- never a single
// group in isolation, since a group's own value depends on the weighted-
// average cost at the moment it happened, which depends on everything
// before it. A group's value is the delta between consecutive replays.
//
// This does not depend on a group's rows being contiguous once sorted by
// time (they are, in the data checked 2026-08-13, but this derivation does
// not assume it): group membership comes from each row's own foreign key,
// not from a timestamp comparison, so two groups sharing a timestamp -- or
// interleaving with a third group for the same item -- would still each get
// their own correct value.
//
// Returns exact (pre-rounding) values. Summed, they equal the exact grand
// total exactly (a telescoping sum) -- rounding each one independently for
// display, as the page does, does not preserve that; see
// lib/display-rounding.ts.
export function computeIssuedEventFigures(stockIssues: any[], purchases: Purchase[]): IssuedEventFigure[] {
  type Group = {
    key: string;
    kind: "STOCKTAKE" | "MANUAL";
    label: string;
    at: number;
    rows: any[];
  };

  const groups = new Map<string, Group>();
  for (const row of stockIssues) {
    const isStocktake = row.source === "STOCKTAKE";
    // Plan D D9 / getRecentIssueSlips precedent: a row written outside a
    // slip (or, symmetrically, a session) carries no group id -- shown as
    // its own one-row group rather than an error. Not reachable today (both
    // foreign keys are populated for every row checked 2026-08-13), but the
    // fallback matches the one already established for this exact gap.
    const groupId = isStocktake ? (row.session_id ?? row.id) : (row.issue_slip_id ?? row.id);
    const key = `${isStocktake ? "S" : "M"}:${groupId}`;
    const atMs = new Date(row.issued_at).getTime();

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        kind: isStocktake ? "STOCKTAKE" : "MANUAL",
        label: isStocktake ? `Kiểm kê định kỳ · ${groupId}` : (row.note?.trim() || "Không có ghi chú"),
        at: atMs,
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.at = Math.min(group.at, atMs);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => a.at - b.at);

  let cumulativeIssues: Issue[] = [];
  let previousTotal = 0;
  const eventFigures: IssuedEventFigure[] = [];
  for (const group of orderedGroups) {
    cumulativeIssues = cumulativeIssues.concat(buildIssueCostingIssues(group.rows));
    const total = computeIssueCosting(purchases, cumulativeIssues).reduce((sum, r) => sum + r.issued_value, 0);
    const valueExact = total - previousTotal;
    previousTotal = total;

    eventFigures.push({
      key: group.key,
      kind: group.kind,
      label: group.label,
      at: new Date(group.at).toISOString(),
      itemCount: new Set(group.rows.map(r => r.purchased_item_id)).size,
      valueExact,
    });
  }

  // Newest first -- matches getRecentIssueSlips's own ordering.
  return eventFigures.reverse();
}
