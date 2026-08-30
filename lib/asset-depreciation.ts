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
  // 2026-08-23 fix (section 3): the schedule's basis is the asset's real
  // allocated total, not quantity * unit_cost. unit_cost is round(total /
  // quantity) -- multiplying that rounded figure back up does not
  // reproduce what was paid (measured across the owner's 72 equipment
  // items: 11 drift, up to 48d on one line). unit_cost is kept elsewhere
  // (assets.unit_cost, AssetSummary.unitCost) for the band lookup and for
  // display -- a derived convenience, never the basis for depreciation.
  total_cost: number;
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

// 2026-08-23 fix (docs/superpowers/plans/2026-08-23-band-bounds-and-crud.md
// section 1): min_unit_price is inclusive, max_unit_price is EXCLUSIVE (null
// still means unbounded). The previous inclusive-inclusive design plus
// integer-adjacency validation only closed the number line when every price
// was a whole đồng -- 199.999,05đ and 500.000,50đ matched no band at all,
// unreachable only because the caller rounded before this function ever saw
// the number. Owner's form, adopted exactly: x < 200.000 -> 12mo,
// 200.000 <= x < 500.000 -> 24mo, 500.000 <= x -> 36mo.
export function findBandForUnitPrice(bands: Band[], unitPrice: number): Band | null {
  return (
    bands.find(
      b => unitPrice >= b.min_unit_price && (b.max_unit_price === null || unitPrice < b.max_unit_price),
    ) ?? null
  );
}

// "Dưới 200.000đ" / "Từ 200.000đ đến dưới 500.000đ" / "Từ 500.000đ trở
// lên" -- the one place this phrasing is written, reused by validateBands'
// error messages and by the register/band screens, so they cannot describe
// the bound differently from each other or from what the code enforces.
export function formatBandRange(band: Band): string {
  if (band.max_unit_price === null) {
    return `Từ ${band.min_unit_price.toLocaleString("vi-VN")}đ trở lên`;
  }
  if (band.min_unit_price === 0) {
    return `Dưới ${band.max_unit_price.toLocaleString("vi-VN")}đ`;
  }
  return `Từ ${band.min_unit_price.toLocaleString("vi-VN")}đ đến dưới ${band.max_unit_price.toLocaleString("vi-VN")}đ`;
}

// Section 1: "Bands must not overlap or leave gaps; validate on save and
// refuse with a Vietnamese message naming the band that collides." Sorted
// by min_unit_price; each band's max must equal the next band's min exactly
// (half-open, not "one less than" -- that was the integer-only assumption
// this fix removes), and only the last band may have no ceiling.
//
// 2026-08-23 addition, beyond what the plan's section 2 asked for: the
// checks above only ever verified consistency AMONG the bands present --
// nothing required the lowest band to start at 0, or that an unbounded
// band exist at all. Once delete is possible (this same task), removing
// the first or last band would pass every check above while leaving a
// genuine coverage hole at one edge of the price line -- worse than a gap
// between two remaining bands, since nothing here would catch it; it
// would only surface later as an opaque "khong tim thay khung khau hao"
// refusal the first time someone buys something priced in the now-
// uncovered range. Closing the hole, not just the case the plan named.
export function validateBands(bands: Band[]): { ok: true } | { ok: false; error: string } {
  if (bands.length === 0) return { ok: false, error: "Phải có ít nhất một khung khấu hao" };

  const sorted = [...bands].sort((a, b) => a.min_unit_price - b.min_unit_price);

  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    if (band.max_unit_price !== null && band.max_unit_price <= band.min_unit_price) {
      return {
        ok: false,
        error: `Khung ${formatBandRange(band)} có giới hạn trên nhỏ hơn hoặc bằng giới hạn dưới`,
      };
    }
    if (band.term_months <= 0) {
      return { ok: false, error: `Khung ${formatBandRange(band)} có số tháng khấu hao không hợp lệ` };
    }

    const isLast = i === sorted.length - 1;
    if (band.max_unit_price === null && !isLast) {
      return {
        ok: false,
        error: `Khung ${formatBandRange(band)} không giới hạn trên nhưng không phải khung cuối cùng -- các khung sau nó sẽ không bao giờ được dùng đến`,
      };
    }
    if (!isLast) {
      const next = sorted[i + 1];
      if (band.max_unit_price === null) continue; // already refused above
      if (band.max_unit_price !== next.min_unit_price) {
        return {
          ok: false,
          error: `Khung ${formatBandRange(band)} và khung ${formatBandRange(next)} chồng lấn hoặc để trống khoảng giữa hai khung`,
        };
      }
    }
  }

  const lowest = sorted[0];
  if (lowest.min_unit_price !== 0) {
    return {
      ok: false,
      error: `Khung thấp nhất phải bắt đầu từ 0đ, hiện đang bắt đầu từ ${lowest.min_unit_price.toLocaleString("vi-VN")}đ -- nếu không, giá thấp hơn mức đó sẽ không có khung nào áp dụng`,
    };
  }
  const highest = sorted[sorted.length - 1];
  if (highest.max_unit_price !== null) {
    return {
      ok: false,
      error: `Phải có một khung không giới hạn trên để bao phủ mọi mức giá -- hiện khung cao nhất dừng ở ${highest.max_unit_price.toLocaleString("vi-VN")}đ`,
    };
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
// to the final month of the term. Each cohort's OWN total cost is its
// proportional share of the asset's total_cost (2026-08-23 fix, section 3),
// with the LAST cohort built absorbing whatever the earlier cohorts'
// rounding left over -- the same "last one absorbs the remainder" device
// used one level down for a cohort's own months, applied once more so the
// cohorts' totals sum to total_cost exactly rather than to
// quantity * round(total_cost / quantity). Each cohort is then settled
// independently within itself: it accrues the ideal (rounded) monthly rate
// for every month except its own settlement month, and its settlement
// month absorbs whatever remains so that cohort's own total sums exactly
// to its share. Summing independently-exact cohorts guarantees the whole
// schedule is exact regardless of how many disposals happen on one asset
// -- there is no running total that could accidentally let one cohort's
// rounding eat into another's.
export function buildAssetSchedule(asset: AssetInput, disposals: DisposalInput[]): MonthlyCharge[] {
  const { total_cost, quantity, term_months } = asset;
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

  const cohortTotals: number[] = [];
  let chargedAcrossCohorts = 0;
  cohorts.forEach((cohort, i) => {
    const isLastCohort = i === cohorts.length - 1;
    const cohortTotal = isLastCohort
      ? total_cost - chargedAcrossCohorts
      : Math.round((total_cost * cohort.qty) / quantity);
    cohortTotals.push(cohortTotal);
    chargedAcrossCohorts += cohortTotal;
  });

  const perMonth = new Array<number>(term_months).fill(0);
  cohorts.forEach((cohort, i) => {
    const cohortTotalCost = cohortTotals[i];
    let chargedSoFar = 0;
    for (let m = 0; m <= cohort.settledAtMonth; m++) {
      const isSettlementMonth = m === cohort.settledAtMonth;
      const charge = isSettlementMonth
        ? cohortTotalCost - chargedSoFar
        : Math.round(cohortTotalCost / term_months);
      chargedSoFar += charge;
      perMonth[m] += charge;
    }
  });

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

// docs/superpowers/plans/2026-08-31-equipment-out-of-issue-slips.md section
// 3.3: today the only date check anywhere is buildAssetSchedule's own
// month-granularity "disposal dated before the asset was acquired" guard
// (line ~217 above) -- real, tested, but two gaps a critique of this plan
// found, not the plan itself: it only compares MONTHS, so a disposal dated
// earlier in the SAME month as acquisition slips through uncaught; and its
// exception is plain-ASCII English, which lib/action-error.ts's
// describeActionError demotes to the generic "Co loi xay ra..." message
// (looksHandWrittenForTheOwner only trusts a message with a Vietnamese
// character) -- so the owner already sees a refusal today, just one that
// never says why or what range is valid. There is also no guard anywhere
// against a FUTURE date; buildAssetSchedule silently clamps it to the
// term's last month.
//
// This function is deliberately day-granular (stricter than the existing
// month-level guard) and called BEFORE buildAssetSchedule at both call
// sites, so a same-month-earlier-day case is caught here with a clear
// message instead of ever reaching the opaque one. The existing guard
// inside buildAssetSchedule is left exactly as it was -- a backstop for
// any future caller that skips this check, not something this duplicates
// away.
//
// Load-bearing: the valid range is inclusive on both ends and rejects nothing between them, including a
// backdate months into the past -- backdating (a disposal recorded today
// for something that broke last month) is what the owner actually does,
// per every other date field in this app (issue slips, purchase orders).
// A guard that refused a valid backdate would be worse than no guard.
export function validateDisposalDate(
  disposedDate: string,
  acquiredDate: string,
  todaySaigon: string,
): { ok: true } | { ok: false; error: string } {
  if (disposedDate < acquiredDate) {
    return {
      ok: false,
      error: `Ngày thanh lý phải từ ngày mua (${formatVnDate(acquiredDate)}) đến hôm nay (${formatVnDate(todaySaigon)}) -- ${formatVnDate(disposedDate)} là trước ngày mua`,
    };
  }
  if (disposedDate > todaySaigon) {
    return {
      ok: false,
      error: `Ngày thanh lý phải từ ngày mua (${formatVnDate(acquiredDate)}) đến hôm nay (${formatVnDate(todaySaigon)}) -- ${formatVnDate(disposedDate)} là ngày trong tương lai`,
    };
  }
  return { ok: true };
}

// "YYYY-MM-DD" -> "DD/MM/YYYY", matching lib/datetime.ts's formatDate
// convention without importing a Saigon-timezone-aware Date parser here --
// these are already plain calendar dates (see this file's own top comment),
// so a string split is exact and does not risk formatDate's UTC-midnight
// round-trip for a value that is already the right calendar day.
function formatVnDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
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
  unit_cost: number; // display only, see AssetInput's total_cost comment
  total_cost: number;
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
    totalCost: asset.total_cost,
    termMonths: asset.term_months,
    remainingValue,
    bucket,
  };
}
