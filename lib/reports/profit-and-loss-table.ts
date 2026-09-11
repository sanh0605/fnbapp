import { formatNumber } from "@/lib/shared/format";
import { displayMoney } from "./display-rounding";
import type { PnlFigures, PnlSource, PnlSourceKind } from "./profit-and-loss";

// Display layer of the monthly P&L
// (docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md).
// lib/reports/profit-and-loss.ts keeps every figure exact; this module is
// the only place the page rounds (BR-DATA-005). Each cell, each total and
// each profit is rounded from its own exact value -- never summed from
// rounded cells -- so a hand-added row can differ from its total by a đồng
// or two, and the page then says so in a footnote.

export type PnlRowKind =
  | "revenue" | "detail" | "cost" | "subtotal" | "expense" | "income" | "net" | "margin" | "cumulative";

export interface PnlCellSource {
  kind: PnlSourceKind | "POS";
  id: string | null;       // null for the POS line
  date: string | null;     // "DD/MM/YYYY"; null when the source has no single date
  label: string;
  ref: string | null;      // purchase order id for a PO line
  amount: number;          // rounded for display
}

export interface PnlCell {
  month: string;             // "YYYY-MM"
  value: number | null;      // null: cannot be computed (margin of a month with no revenue)
  sources: PnlCellSource[];
  formula: string | null;    // profit rows only
}

export interface PnlRow {
  key: string;               // "revenue", "revenueManual", "cogs", "nonInventory", "shrinkage",
                             // "grossProfit", "expense:<category id>", "depreciation",
                             // "otherIncome", "netProfit", "margin", "cumulative"
  label: string;
  kind: PnlRowKind;
  unit: "money" | "percent";
  cells: PnlCell[];
  total: number | null;
  shareOfRevenue: number | null;
}

export interface PnlMonthColumn {
  month: string;         // "YYYY-MM"
  label: string;         // unchanged: "09/2026 (đến 11/09)"
  shortLabel: string;    // unchanged: "09"
  title: string;         // "09/2026"
  head: string;          // "09/26"
  until: string | null;  // "11/09" for the month still running, else null
  notes: number[];       // numbers of the footnotes whose `months` include this month, ascending
}
export interface PnlSummaryMonth { month: string; label: string; netProfit: number }

export interface PnlFootnote {
  key: string;
  number: number;        // 1-based position in `footnotes`
  months: string[];      // "YYYY-MM" months the note is about; [] for the rounding note
  text: string;          // unchanged wording, except the stocktake tail below
  strong: string[];      // substrings of `text` to show in bold, e.g. "8.411.868đ"
}

export interface PnlTable {
  year: number;
  months: PnlMonthColumn[];
  periodLabel: "từ đầu năm" | "cả năm";
  rows: PnlRow[];
  summary: {
    revenue: number;
    netProfit: number;
    margin: number | null;
    bestMonth: PnlSummaryMonth | null;   // highest net profit above 0
    worstMonth: PnlSummaryMonth | null;  // lowest net profit below 0
  };
  chart: Array<{ month: string; shortLabel: string; head: string; partial: boolean; netProfit: number; cumulative: number }>;
  footnotes: PnlFootnote[];
}

// Decimals kept on a percentage: two, owner decision 2026-09-11 (BR-DATA-005).
export const PERCENT_DECIMALS = 2;

const NEAR_ZERO = 0.005;
const MINUS = "−"; // U+2212, the operator in a formula; a negative number keeps formatNumber's "-"

const ROUNDING_NOTE =
  "Mỗi ô làm tròn riêng về đồng từ số thật của nó (luật ngày 11/09/2026). Ô Tổng và các ô lợi nhuận cũng làm tròn từ số thật, không cộng từ các ô đã làm tròn, nên cộng tay có thể lệch một, hai đồng.";

const STOCKTAKE_TAIL =
  "Các tháng trước đó vì vậy có giá vốn thấp hơn thực tế; nhìn dòng Luỹ kế mới thấy đúng bức tranh.";

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: PERCENT_DECIMALS,
  maximumFractionDigits: PERCENT_DECIMALS,
});

export function formatPercent(value: number | null): string {
  return value === null ? "---" : `${PERCENT_FORMATTER.format(value)}%`;
}

// Same snapping as display-rounding.ts, at PERCENT_DECIMALS places.
function roundPercent(exact: number): number {
  const factor = 10 ** PERCENT_DECIMALS;
  const snapped = Math.round(Math.abs(exact) * factor * 1e6) / 1e6;
  const rounded = (Math.sign(exact) * Math.round(snapped)) / factor;
  return rounded === 0 ? 0 : rounded;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const money = (exact: number) => formatNumber(displayMoney(exact));
const anyNonZero = (xs: number[]) => xs.some(x => Math.abs(x) > NEAR_ZERO);

function dateLabel(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function monthLabel(month: string): string {
  return `${month.slice(5, 7)}/${month.slice(0, 4)}`;
}

function toCellSource(s: PnlSource): PnlCellSource {
  return { kind: s.kind, id: s.id, date: dateLabel(s.date), label: s.label, ref: s.ref, amount: displayMoney(s.amountExact) };
}

export function buildPnlTable(figures: PnlFigures, today: string): PnlTable {
  const months = figures.months;
  const currentMonth = today.slice(0, 7);

  // Exact per-month figures. Profit comes from these, never from rounded cells.
  const exact = months.map(m => {
    const revenue = m.posRevenue + m.manualRevenue;
    const gross = revenue - m.cogsExact - m.nonInventoryExact - m.shrinkageExact;
    const expenses = sum(Object.values(m.expenseByCategory));
    const net = gross - expenses - m.depreciationExact + m.otherIncome;
    return { revenue, gross, expenses, net };
  });
  let running = 0;
  const cumulative = exact.map(e => (running += e.net));
  const yearRevenue = sum(exact.map(e => e.revenue));
  const yearNet = sum(exact.map(e => e.net));
  const hasRevenue = (x: number) => Math.abs(x) > NEAR_ZERO;

  function moneyRow(
    key: string,
    label: string,
    kind: PnlRowKind,
    exactValues: number[],
    sourcesOf: (i: number) => PnlCellSource[],
    formulaOf: (i: number) => string | null = () => null,
  ): PnlRow {
    const exactTotal = sum(exactValues);
    return {
      key, label, kind, unit: "money",
      cells: months.map((m, i) => ({ month: m.month, value: displayMoney(exactValues[i]), sources: sourcesOf(i), formula: formulaOf(i) })),
      total: displayMoney(exactTotal),
      shareOfRevenue: hasRevenue(yearRevenue) ? roundPercent((exactTotal / yearRevenue) * 100) : null,
    };
  }
  const noSources = () => [];

  const manual = months.map(m => m.manualRevenue);
  const shrinkage = months.map(m => m.shrinkageExact);
  const otherIncome = months.map(m => m.otherIncome);
  const showShrinkage = anyNonZero(shrinkage);
  const showOtherIncome = anyNonZero(otherIncome);

  const rows: PnlRow[] = [];
  rows.push(moneyRow("revenue", "Doanh thu", "revenue", exact.map(e => e.revenue), i => {
    const m = months[i];
    const pos: PnlCellSource[] = m.posOrderCount > 0
      ? [{ kind: "POS", id: null, date: null, label: `${formatNumber(m.posOrderCount)} đơn máy bán hàng`, ref: null, amount: displayMoney(m.posRevenue) }]
      : [];
    return [...pos, ...m.sources.manualRevenue.map(toCellSource)];
  }));
  if (anyNonZero(manual)) {
    rows.push(moneyRow("revenueManual", "· trong đó ghi tay", "detail", manual, i => months[i].sources.manualRevenue.map(toCellSource)));
  }
  rows.push(moneyRow("cogs", "Giá vốn", "cost", months.map(m => m.cogsExact), i => months[i].sources.cogs.map(toCellSource)));
  rows.push(moneyRow("nonInventory", "Nguyên liệu mua dùng ngay", "cost", months.map(m => m.nonInventoryExact), i => months[i].sources.nonInventory.map(toCellSource)));
  if (showShrinkage) {
    rows.push(moneyRow("shrinkage", "Hao hụt", "cost", shrinkage, i => months[i].sources.shrinkage.map(toCellSource)));
  }
  rows.push(moneyRow("grossProfit", "Lợi nhuận gộp", "subtotal", exact.map(e => e.gross), noSources, i => {
    const m = months[i];
    const parts = [`Doanh thu ${money(exact[i].revenue)}`, `giá vốn ${money(m.cogsExact)}`, `nguyên liệu mua dùng ngay ${money(m.nonInventoryExact)}`];
    if (showShrinkage) parts.push(`hao hụt ${money(m.shrinkageExact)}`);
    return `${parts.join(` ${MINUS} `)} = ${money(exact[i].gross)}`;
  }));
  for (const category of figures.expenseCategories) {
    rows.push(moneyRow(
      `expense:${category.id}`, category.name, "expense",
      months.map(m => m.expenseByCategory[category.id] ?? 0),
      i => (months[i].sources.expense[category.id] ?? []).map(toCellSource),
    ));
  }
  rows.push(moneyRow("depreciation", "Khấu hao", "expense", months.map(m => m.depreciationExact), i => months[i].sources.depreciation.map(toCellSource)));
  if (showOtherIncome) {
    rows.push(moneyRow("otherIncome", "Thu khác", "income", otherIncome, i => months[i].sources.otherIncome.map(toCellSource)));
  }
  rows.push(moneyRow("netProfit", "Lợi nhuận ròng", "net", exact.map(e => e.net), noSources, i => {
    let text = `Lợi nhuận gộp ${money(exact[i].gross)} ${MINUS} chi phí ${money(exact[i].expenses)} ${MINUS} khấu hao ${money(months[i].depreciationExact)}`;
    if (showOtherIncome) text += ` + thu khác ${money(months[i].otherIncome)}`;
    return `${text} = ${money(exact[i].net)}`;
  }));
  rows.push({
    key: "margin", label: "Biên lợi nhuận", kind: "margin", unit: "percent",
    cells: months.map((m, i) => hasRevenue(exact[i].revenue)
      ? {
          month: m.month,
          value: roundPercent((exact[i].net / exact[i].revenue) * 100),
          sources: [],
          formula: `Lợi nhuận ròng ${money(exact[i].net)} ÷ doanh thu ${money(exact[i].revenue)}`,
        }
      : { month: m.month, value: null, sources: [], formula: "Tháng này chưa có doanh thu, nên không tính được biên lợi nhuận." }),
    total: hasRevenue(yearRevenue) ? roundPercent((yearNet / yearRevenue) * 100) : null,
    shareOfRevenue: null,
  });
  rows.push({
    key: "cumulative", label: "Luỹ kế", kind: "cumulative", unit: "money",
    cells: months.map((m, i) => ({
      month: m.month,
      value: displayMoney(cumulative[i]),
      sources: [],
      formula: i === 0
        ? `Tháng đầu tiên có số của năm: bằng lợi nhuận ròng tháng này ${money(exact[0].net)}`
        : `Luỹ kế tháng trước ${money(cumulative[i - 1])} + lợi nhuận ròng tháng này ${money(exact[i].net)} = ${money(cumulative[i])}`,
    })),
    total: null,
    shareOfRevenue: null,
  });

  // Does adding shown numbers by hand ever miss a shown result? Then say why.
  const shown = (key: string) => rows.find(r => r.key === key)?.cells.map(c => c.value ?? 0) ?? months.map(() => 0);
  let roundingGap = rows.some(r => r.unit === "money" && r.total !== null && sum(r.cells.map(c => c.value ?? 0)) !== r.total);
  const [rev, cogs, nonInv, shr, gross, dep, oth, net, cum] =
    ["revenue", "cogs", "nonInventory", "shrinkage", "grossProfit", "depreciation", "otherIncome", "netProfit", "cumulative"].map(shown);
  months.forEach((_, i) => {
    if (rev[i] - cogs[i] - nonInv[i] - shr[i] !== gross[i]) roundingGap = true;
    if (gross[i] - displayMoney(exact[i].expenses) - dep[i] + oth[i] !== net[i]) roundingGap = true;
    if (i > 0 && cum[i - 1] + net[i] !== cum[i]) roundingGap = true;
  });

  type RawFootnote = { key: string; months: string[]; text: string; strong: string[] };
  const rawFootnotes: RawFootnote[] = [];
  for (const m of months) {
    if (Math.abs(m.manualRevenue) > NEAR_ZERO) {
      const amount = `${money(m.manualRevenue)}đ`;
      rawFootnotes.push({
        key: `manual-${m.month}`,
        months: [m.month],
        text: `Doanh thu tháng ${monthLabel(m.month)} có ${amount} ghi tay trong sổ thu chi, không qua máy bán hàng.`,
        strong: [amount],
      });
    }
  }
  const firstMonth = months[0]?.month ?? null;
  for (const m of months) {
    for (const s of m.sources.cogs) {
      if (s.kind !== "STOCKTAKE") continue;
      const amount = `${money(s.amountExact)}đ`;
      let text = `Giá vốn tháng ${monthLabel(m.month)} có ${amount} từ lần kiểm kho ngày ${dateLabel(s.date)}: hàng đã dùng mà chưa ghi phiếu xuất, không tính là hao hụt.`;
      if (m.month !== firstMonth) text += ` ${STOCKTAKE_TAIL}`;
      rawFootnotes.push({ key: `stocktake-${s.id}-${m.month}`, months: [m.month], text, strong: [amount] });
    }
  }
  // BR-SALE-005: before the first payment record, revenue can only be checked against itself.
  const uncheckedMonths = months.filter(m => Math.abs(m.posRevenueBeforePayments) > NEAR_ZERO).map(m => m.month);
  if (uncheckedMonths.length > 0) {
    const uncheckedLabels = uncheckedMonths.map(monthLabel).join(", ");
    rawFootnotes.push({
      key: "before-payments",
      months: uncheckedMonths,
      text: figures.firstPaymentDate
        ? `Doanh thu tháng ${uncheckedLabels} có phần bán trước ngày ${dateLabel(figures.firstPaymentDate)}, ngày bắt đầu có sổ tiền nhận, nên phần đó không có sổ tiền để đối chiếu.`
        : `Chưa có sổ tiền nhận nào, nên doanh thu tháng ${uncheckedLabels} chưa đối chiếu được với tiền đã nhận.`,
      strong: [],
    });
  }
  if (roundingGap) rawFootnotes.push({ key: "rounding", months: [], text: ROUNDING_NOTE, strong: [] });
  const footnotes: PnlFootnote[] = rawFootnotes.map((f, i) => ({ ...f, number: i + 1 }));

  const netByMonth = months.map((m, i) => ({ month: m.month, label: monthLabel(m.month), exact: exact[i].net }));
  const best = netByMonth.filter(x => x.exact > NEAR_ZERO).sort((a, b) => b.exact - a.exact)[0];
  const worst = netByMonth.filter(x => x.exact < -NEAR_ZERO).sort((a, b) => a.exact - b.exact)[0];
  const summaryMonth = (x: typeof best | undefined): PnlSummaryMonth | null =>
    x ? { month: x.month, label: x.label, netProfit: displayMoney(x.exact) } : null;

  return {
    year: figures.year,
    months: months.map(m => {
      const until = m.month === currentMonth ? `${today.slice(8, 10)}/${today.slice(5, 7)}` : null;
      return {
        month: m.month,
        label: until ? `${monthLabel(m.month)} (đến ${until})` : monthLabel(m.month),
        shortLabel: m.month.slice(5, 7),
        title: monthLabel(m.month),
        head: `${m.month.slice(5, 7)}/${m.month.slice(2, 4)}`,
        until,
        notes: footnotes.filter(f => f.months.includes(m.month)).map(f => f.number),
      };
    }),
    periodLabel: figures.year < Number(today.slice(0, 4)) ? "cả năm" : "từ đầu năm",
    rows,
    summary: {
      revenue: displayMoney(yearRevenue),
      netProfit: displayMoney(yearNet),
      margin: hasRevenue(yearRevenue) ? roundPercent((yearNet / yearRevenue) * 100) : null,
      bestMonth: summaryMonth(best),
      worstMonth: summaryMonth(worst),
    },
    chart: months.map((m, i) => ({
      month: m.month,
      shortLabel: m.month.slice(5, 7),
      head: `${m.month.slice(5, 7)}/${m.month.slice(2, 4)}`,
      partial: m.month === currentMonth,
      netProfit: displayMoney(exact[i].net),
      cumulative: displayMoney(cumulative[i]),
    })),
    footnotes,
  };
}
