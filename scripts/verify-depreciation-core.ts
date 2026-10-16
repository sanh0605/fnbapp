// Independent second calculation of the depreciation schedule (BR-COGS-008), written from the
// rule and deliberately NOT importing lib/assets/asset-depreciation.ts. Pure: no I/O.
//
// Independence limit: only the schedule arithmetic is independent. Price, date, term and quantity
// are read from the same `assets` / `asset_disposals` rows the app uses, so a wrongly entered
// purchase price (e.g. the 12 assets corrected 2026-10-08) is not caught here.
//
// Rule: a group of q units has share = total_cost * q / quantity. Months are counted from the
// acquisition month (month 0). A group that is not disposed charges share / term every month of
// the term. A group disposed in month t (clamped to the last term month) charges share / term
// for months before t, the whole remainder share * (term - t) / term in month t, then nothing.
// Nothing is rounded here.

export interface DepAsset {
  id: string;
  acquired_date: string; // "YYYY-MM-DD"
  total_cost: number;
  quantity: number;
  term_months: number;
  status: string;
}
export interface DepDisposal {
  asset_id: string;
  quantity: number;
  disposed_date: string; // "YYYY-MM-DD"
}

const monthNo = (date: string): number => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthKey = (n: number): string => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;

// today: "YYYY-MM". Used for the lifetime check on assets whose charging has already ended.
export function computeDepreciation(assets: DepAsset[], disposals: DepDisposal[], today: string) {
  const months: Record<string, Record<string, number>> = {};
  const problems: string[] = [];
  const nowNo = monthNo(today);

  for (const a of assets) {
    if (a.status === "INACTIVE") continue;
    const total = Number(a.total_cost);
    const qty = Number(a.quantity);
    const term = Number(a.term_months);
    const start = monthNo(a.acquired_date);
    if (!(term > 0) || !(qty > 0)) {
      problems.push(`${a.id}: unusable term_months ${a.term_months} or quantity ${a.quantity}`);
      continue;
    }
    const own = disposals.filter(d => d.asset_id === a.id);
    const disposedQty = own.reduce((s, d) => s + Number(d.quantity), 0);
    if (disposedQty > qty) {
      problems.push(`${a.id}: disposals total ${disposedQty} units, asset has ${qty}`);
      continue;
    }
    const earliest = Math.min(...own.map(d => monthNo(d.disposed_date)));
    if (earliest < start) {
      problems.push(`${a.id}: disposal dated before the acquisition month`);
      continue;
    }

    // groups: [units, month index at which the group's remainder is charged]
    const groups: Array<[number, number]> = own.map(d => [Number(d.quantity), Math.min(monthNo(d.disposed_date) - start, term - 1)]);
    if (disposedQty < qty) groups.push([qty - disposedQty, term - 1]);

    const charges = new Array<number>(term).fill(0);
    for (const [q, t] of groups) {
      const share = (total * q) / qty;
      for (let m = 0; m < t; m++) charges[m] += share / term;
      charges[t] += (share * (term - t)) / term;
    }
    charges.forEach((c, m) => {
      if (c === 0) return;
      (months[monthKey(start + m)] ??= {})[a.id] = c;
    });

    // Charging has ended when the last charged month is not after today; then the whole cost is charged.
    const last = disposedQty === qty ? Math.max(...groups.map(g => g[1])) : term - 1;
    if (start + last <= nowNo) {
      const sum = charges.reduce((s, c) => s + c, 0);
      if (Math.abs(sum - total) > 0.01) problems.push(`${a.id}: charged ${sum} over its life, total_cost is ${total}`);
    }
  }
  return { months, problems };
}
