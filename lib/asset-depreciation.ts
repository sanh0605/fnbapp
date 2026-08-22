// Batch 3 (docs/superpowers/plans/2026-08-22-batch-3-asset-register.md
// section 4): the monthly depreciation charge, pure and testable without a
// database, mirroring how lib/issue-costing.ts is structured.
//
// Dates are plain "YYYY-MM-DD" calendar dates (Postgres `date` columns, no
// time-of-day component), so month arithmetic here is done on parsed
// year/month integers only -- never through a JS Date's own month math,
// which is timezone-sensitive and is exactly the class of bug
// lib/report-time.ts exists to guard against for timestamp columns. There
// is no time-of-day here to misinterpret, so there is nothing to convert.

export type Band = {
  min_unit_price: number;
  max_unit_price: number | null;
  term_months: number;
};

export type AssetInput = {
  acquired_date: string; // "YYYY-MM-DD"
  unit_cost: number;
  quantity: number;
  term_months: number;
};

export type DisposalInput = {
  quantity: number;
  disposed_date: string; // "YYYY-MM-DD"
};

export type MonthlyCharge = {
  month: string; // "YYYY-MM"
  unitsHeld: number;
  charge: number;
};

type YearMonth = { year: number; month: number }; // month is 1-12

function parseYearMonth(dateStr: string, context: string): YearMonth {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(dateStr);
  if (!match) {
    throw new Error(`${context}: unusable date (${JSON.stringify(dateStr)})`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function monthIndex(ym: YearMonth): number {
  return ym.year * 12 + (ym.month - 1);
}

function addMonths(ym: YearMonth, delta: number): YearMonth {
  const total = monthIndex(ym) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function monthKey(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

// Section 3.1: find which band a unit price falls into. Bounds are
// inclusive on both ends (the seeded bands: 0-199999 -> 12mo,
// 200000-500000 -> 24mo, 500001-null(no ceiling) -> 36mo -- "under 200k",
// "200k-500k", "above 500k" read as the owner's own worked example
// confirms: 497.697d falls under 500k, so the second band's ceiling is
// inclusive of exactly 500.000d).
export function findBandForUnitPrice(bands: Band[], unitPrice: number): Band | null {
  return (
    bands.find(
      b => unitPrice >= b.min_unit_price && (b.max_unit_price === null || unitPrice <= b.max_unit_price),
    ) ?? null
  );
}

// Section 3.1: "Bands must not overlap or leave gaps; validate on save and
// refuse with a Vietnamese message naming the band that collides." Sorted
// by min_unit_price; each band's max must be exactly one less than the
// next band's min, and only the last band may have no ceiling.
export function validateBands(bands: Band[]): { ok: true } | { ok: false; error: string } {
  if (bands.length === 0) return { ok: false, error: "Phải có ít nhất một khung khấu hao" };

  const sorted = [...bands].sort((a, b) => a.min_unit_price - b.min_unit_price);

  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    if (band.max_unit_price !== null && band.max_unit_price < band.min_unit_price) {
      return {
        ok: false,
        error: `Khung ${band.min_unit_price.toLocaleString("vi-VN")}đ-${band.max_unit_price.toLocaleString("vi-VN")}đ có giới hạn trên nhỏ hơn giới hạn dưới`,
      };
    }
    if (band.term_months <= 0) {
      return { ok: false, error: `Khung ${band.min_unit_price.toLocaleString("vi-VN")}đ có số tháng khấu hao không hợp lệ` };
    }

    const isLast = i === sorted.length - 1;
    if (band.max_unit_price === null && !isLast) {
      return {
        ok: false,
        error: `Khung ${band.min_unit_price.toLocaleString("vi-VN")}đ không giới hạn trên nhưng không phải khung cuối cùng -- các khung sau nó sẽ không bao giờ được dùng đến`,
      };
    }
    if (!isLast) {
      const next = sorted[i + 1];
      if (band.max_unit_price === null) continue; // already refused above
      if (band.max_unit_price + 1 !== next.min_unit_price) {
        return {
          ok: false,
          error: `Khung ${band.min_unit_price.toLocaleString("vi-VN")}đ-${band.max_unit_price.toLocaleString("vi-VN")}đ và khung ${next.min_unit_price.toLocaleString("vi-VN")}đ chồng lấn hoặc để trống khoảng giữa hai khung`,
        };
      }
    }
  }

  return { ok: true };
}

// Section 4: builds the whole term_months-month schedule for one asset,
// applying disposals as they occur.
//
// "Units still held that month = quantity minus disposals dated before
// it" -- a disposal DATED in month m does not reduce month m's own units-
// held count; the regular charge for month m still covers the full
// quantity that started the month, and the disposal converts whatever
// remains unaccrued for exactly the disposed units into an extra charge in
// that same month (worked example 2: month 3 charges both the regular
// 3.750d and the remaining 33.750d).
//
// Implemented by splitting quantity into cohorts -- one per disposal event
// (in date order) plus, if anything is left over, one cohort that survives
// to the final month of the term. Each cohort is settled independently: it
// accrues the ideal (rounded) monthly rate for every month except its own
// settlement month, and its settlement month absorbs whatever remains so
// that cohort's own total sums exactly to quantity * unit_cost. Summing
// independently-exact cohorts guarantees the whole schedule is exact
// regardless of how many disposals happen on one asset -- there is no
// running total that could accidentally let one cohort's rounding eat into
// another's.
export function buildAssetSchedule(asset: AssetInput, disposals: DisposalInput[]): MonthlyCharge[] {
  const { unit_cost, quantity, term_months } = asset;
  if (quantity <= 0) throw new Error("asset has no quantity to depreciate");
  if (term_months <= 0) throw new Error("asset has no term to depreciate over");

  const acquiredMonth = parseYearMonth(asset.acquired_date, "acquired_date");

  const sortedDisposals = [...disposals].sort(
    (a, b) => monthIndex(parseYearMonth(a.disposed_date, "disposed_date")) - monthIndex(parseYearMonth(b.disposed_date, "disposed_date")),
  );

  let remaining = quantity;
  const cohorts: Array<{ qty: number; settledAtMonth: number }> = [];
  for (const d of sortedDisposals) {
    if (d.quantity <= 0) continue;
    if (remaining <= 0) {
      throw new Error("disposals exceed the asset's quantity");
    }
    const qty = Math.min(d.quantity, remaining);
    if (qty < d.quantity) {
      throw new Error("disposals exceed the asset's quantity");
    }
    const disposalMonth = monthIndex(parseYearMonth(d.disposed_date, "disposed_date")) - monthIndex(acquiredMonth);
    if (disposalMonth < 0) {
      throw new Error("disposal dated before the asset was acquired");
    }
    // A disposal dated on or after the term's own natural end changes
    // nothing about the schedule -- those months already fully accrued the
    // cost. Not an error: a genuinely late disposal record is legitimate,
    // it just has no remaining value left to charge.
    const settledAtMonth = Math.min(disposalMonth, term_months - 1);
    cohorts.push({ qty, settledAtMonth });
    remaining -= qty;
  }
  if (remaining > 0) {
    cohorts.push({ qty: remaining, settledAtMonth: term_months - 1 });
  }

  const perMonth = new Array<number>(term_months).fill(0);
  for (const cohort of cohorts) {
    const cohortTotalCost = cohort.qty * unit_cost;
    let chargedSoFar = 0;
    for (let m = 0; m <= cohort.settledAtMonth; m++) {
      const isSettlementMonth = m === cohort.settledAtMonth;
      const charge = isSettlementMonth
        ? cohortTotalCost - chargedSoFar
        : Math.round((cohort.qty * unit_cost) / term_months);
      chargedSoFar += charge;
      perMonth[m] += charge;
    }
  }

  const disposedBefore = (m: number): number =>
    sortedDisposals
      .filter(d => monthIndex(parseYearMonth(d.disposed_date, "disposed_date")) - monthIndex(acquiredMonth) < m)
      .reduce((sum, d) => sum + d.quantity, 0);

  return perMonth.map((charge, m) => ({
    month: monthKey(addMonths(acquiredMonth, m)),
    unitsHeld: Math.max(0, quantity - disposedBefore(m)),
    charge,
  }));
}

export function totalScheduledCharge(schedule: MonthlyCharge[]): number {
  return schedule.reduce((sum, m) => sum + m.charge, 0);
}

// Section 5.1's "remaining value" card, and section 5.2's disposal preview
// (called against a schedule built with the hypothetical disposal already
// appended, then read at that disposal's own month).
export function remainingValueAsOf(schedule: MonthlyCharge[], asOfMonth: string): number {
  const total = totalScheduledCharge(schedule);
  const chargedThroughAsOf = schedule
    .filter(m => m.month <= asOfMonth)
    .reduce((sum, m) => sum + m.charge, 0);
  return total - chargedThroughAsOf;
}

export function chargeForMonth(schedule: MonthlyCharge[], month: string): number {
  return schedule.find(m => m.month === month)?.charge ?? 0;
}

export type AssetSummaryInput = {
  id: string;
  name: string;
  acquired_date: string;
  unit_cost: number;
  quantity: number;
  term_months: number;
};

export type AssetBucket = "IN_USE" | "FULLY_DEPRECIATED" | "DISPOSED";

export type AssetSummary = {
  id: string;
  name: string;
  quantity: number;
  remainingQuantity: number;
  acquiredDate: string;
  unitCost: number;
  totalCost: number;
  termMonths: number;
  remainingValue: number;
  bucket: AssetBucket;
};

// Section 5.1's three filter buckets, and section 1's "an item whose term
// has ended stays listed at 0d; only marking it broken or disposed removes
// it." All derived here from quantity/disposals/term/acquired_date, taking
// asOfMonth explicitly rather than reading the clock -- keeps this testable
// without depending on when the test happens to run, mirroring how
// lib/report-time.ts's callers pass an explicit range rather than "now".
export function summarizeAsset(
  asset: AssetSummaryInput,
  disposals: DisposalInput[],
  asOfMonth: string,
): AssetSummary {
  const schedule = buildAssetSchedule(asset, disposals);
  const disposedQuantity = disposals.reduce((sum, d) => sum + d.quantity, 0);
  const remainingQuantity = Math.max(0, asset.quantity - disposedQuantity);
  const remainingValue = Math.max(0, remainingValueAsOf(schedule, asOfMonth));
  const termEndMonth = schedule[schedule.length - 1]?.month ?? asOfMonth;

  const bucket: AssetBucket =
    remainingQuantity <= 0 ? "DISPOSED" : asOfMonth > termEndMonth ? "FULLY_DEPRECIATED" : "IN_USE";

  return {
    id: asset.id,
    name: asset.name,
    quantity: asset.quantity,
    remainingQuantity,
    acquiredDate: asset.acquired_date,
    unitCost: asset.unit_cost,
    totalCost: asset.quantity * asset.unit_cost,
    termMonths: asset.term_months,
    remainingValue,
    bucket,
  };
}
