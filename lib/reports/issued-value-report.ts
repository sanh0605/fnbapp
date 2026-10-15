import { computeIssueCosting, computePeriodIssuedValueSplit, type Purchase, type Issue, type ClassifiedIssue } from "@/lib/costing/issue-costing";
import { buildIssueCostingIssues } from "@/lib/costing/issue-costing-inputs";
import { toSaigonUtcRange } from "@/lib/shared/report-time";

// Plan G. Split out of app/admin/reports/issued/actions.ts (not defined
// there) because that file is "use server" -- every export from a "use
// server" file must be an async server action, and CLAUDE.md "Lệnh"
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

// Without a range: everything issued so far. With one: what left inside it (the
// engine's two-replay subtraction, per item); closing value is as of the range end.
export function computeIssuedItemFigures(
  purchases: Purchase[],
  allIssues: Issue[],
  startUtc: Date | null = null,
  endUtc: Date | null = null,
): IssuedItemFigure[] {
  const through = computeIssueCosting(
    purchases,
    endUtc ? allIssues.filter(i => new Date(i.at).getTime() <= endUtc.getTime()) : allIssues,
  );
  const before = new Map(
    (startUtc ? computeIssueCosting(purchases, allIssues.filter(i => new Date(i.at).getTime() < startUtc.getTime())) : [])
      .map(r => [r.purchased_item_id, r]),
  );
  return through.map(r => ({
    purchasedItemId: r.purchased_item_id,
    issuedQuantity: r.issued_quantity - (before.get(r.purchased_item_id)?.issued_quantity ?? 0),
    issuedValueExact: r.issued_value - (before.get(r.purchased_item_id)?.issued_value ?? 0),
    closingValueExact: r.closing_value,
  }));
}

// Up to two distinct item names in line order, then " và N mặt hàng khác".
// An item with no known name is skipped rather than shown as a code.
function slipLabel(rows: any[], itemNameById: ReadonlyMap<string, string>): string {
  const names: string[] = [];
  for (const r of rows) {
    const name = itemNameById.get(r.purchased_item_id);
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length === 0) return "Phiếu xuất";
  const head = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${head} và ${names.length - 2} mặt hàng khác` : head;
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
// one RPC call writes a whole session or a whole slip at once). A group's
// value is the delta of the running total before and after it -- never the
// group costed in isolation, since its weighted-average cost depends on
// everything before it (how the running total is kept: see below).
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
// lib/reports/display-rounding.ts.
export function computeIssuedEventFigures(
  stockIssues: any[],
  purchases: Purchase[],
  itemNameById: ReadonlyMap<string, string> = new Map(),
): IssuedEventFigure[] {
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
    // Plan D D9: a row written outside a slip (or, symmetrically, a session)
    // carries no group id -- shown as its own one-row group rather than an
    // error. Not reachable today (both foreign keys are populated for every
    // row checked 2026-08-13), but the fallback covers this exact gap.
    const groupId = isStocktake ? (row.session_id ?? row.id) : (row.issue_slip_id ?? row.id);
    const key = `${isStocktake ? "S" : "M"}:${groupId}`;
    const atMs = new Date(row.issued_at).getTime();

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        kind: isStocktake ? "STOCKTAKE" : "MANUAL",
        // CLAUDE.md "Nói chuyện với chủ quán": never read a code to the owner. The date is
        // already on the card, so the session id adds nothing a person
        // reading the card needs.
        // BR-INV-014: a slip has no note; its card is titled by its items,
        // filled in below once every row of the group is known.
        label: isStocktake ? "Kiểm kê định kỳ" : "",
        at: atMs,
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.at = Math.min(group.at, atMs);
  }

  for (const group of groups.values()) {
    if (group.kind === "MANUAL") group.label = slipLabel(group.rows, itemNameById);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => a.at - b.at);

  // Items never interact in the engine, so only the items a group touches are
  // replayed again (with their own full history so far). The running total is
  // summed in the order computeIssueCosting lists its items -- the purchases'
  // items first, then issue-only items as they first appear -- so every
  // group's figure is identical to replaying everything.
  const purchasesByItem = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = purchasesByItem.get(p.purchased_item_id) ?? [];
    list.push(p);
    purchasesByItem.set(p.purchased_item_id, list);
  }
  if (orderedGroups.length > 0) computeIssueCosting(purchases, []); // validates every purchase once, as a full replay would
  const issuesByItem = new Map<string, Issue[]>();
  const issuedValueByItem = new Map<string, number>([...purchasesByItem.keys()].map(id => [id, 0]));
  let previousTotal = 0;
  const eventFigures: IssuedEventFigure[] = [];
  for (const group of orderedGroups) {
    for (const issue of buildIssueCostingIssues(group.rows)) {
      const list = issuesByItem.get(issue.purchased_item_id) ?? [];
      list.push(issue);
      issuesByItem.set(issue.purchased_item_id, list);
      issuedValueByItem.set(issue.purchased_item_id, issuedValueByItem.get(issue.purchased_item_id) ?? 0);
    }
    for (const itemId of new Set(group.rows.map(r => r.purchased_item_id))) {
      const [cost] = computeIssueCosting(purchasesByItem.get(itemId) ?? [], issuesByItem.get(itemId)!);
      issuedValueByItem.set(itemId, cost.issued_value);
    }
    let total = 0;
    for (const value of issuedValueByItem.values()) total += value;
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

  // Newest first.
  return eventFigures.reverse();
}

export type IssuedMonthFigure = {
  yearMonth: string; // "YYYY-MM", Saigon calendar
  costExact: number; // Hàng dùng: Lãi lỗ's Giá vốn line
  shrinkageExact: number; // Hao hụt
};

function nextYearMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Tab "Theo tháng": one row per whole Saigon month from fromMonth to toMonth ("YYYY-MM"),
// zero months included. Each month is computePeriodIssuedValueSplit, the call Lãi lỗ makes
// (lib/reports/profit-and-loss.ts), so Hàng dùng + Hao hụt equals its Giá vốn + Hao hụt.
// Consecutive months' boundaries are adjacent (toSaigonUtcRange), so the months partition
// the range with no gap and no overlap.
export function computeIssuedMonthFigures(
  purchases: Purchase[],
  allIssues: ClassifiedIssue[],
  fromMonth: string,
  toMonth: string,
): IssuedMonthFigure[] {
  const figures: IssuedMonthFigure[] = [];
  for (let ym = fromMonth; ym <= toMonth; ym = nextYearMonth(ym)) {
    const [year, month] = ym.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const range = toSaigonUtcRange(`${ym}-01`, `${ym}-${String(lastDay).padStart(2, "0")}`)!;
    const split = computePeriodIssuedValueSplit(purchases, allIssues, range.startUtc, range.endUtc);
    figures.push({ yearMonth: ym, costExact: split.cost, shrinkageExact: split.shrinkage });
  }
  // Newest first -- matches the events tab.
  return figures.reverse();
}
