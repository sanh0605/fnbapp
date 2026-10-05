import { saigonBucketKeys } from "@/lib/shared/report-time";

// Plan D I6: a backdated issue slip changes a closed period's cost, not just
// its own day. computeIssueCosting replays chronologically, so the weighted
// average shifts starting at the slip's own instant and stays shifted
// through every event after it -- every month from the slip's month through
// the current month reads a different number, not only the slip's own
// month. Understating this to "only this month changes" would be wrong, not
// just incomplete (plan section 8, D7a).
export function computeAffectedMonths(issuedAt: Date, now: Date = new Date()): string[] {
  // Months are Saigon months (BR-DATA-006), not the runtime's own zone.
  const start = saigonBucketKeys(issuedAt.toISOString()).monthKey;
  const end = saigonBucketKeys(now.toISOString()).monthKey;
  const startY = Number(start.slice(0, 4));
  const startM = Number(start.slice(5, 7)) - 1;
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(5, 7)) - 1;

  if (startY > endY || (startY === endY && startM > endM)) {
    return []; // future-dated -- the RPC itself refuses this, nothing to warn about here
  }
  if (startY === endY && startM === endM) {
    return []; // same month as now -- nothing closed yet to disturb
  }

  const months: string[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`Tháng ${m + 1}/${y}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}
