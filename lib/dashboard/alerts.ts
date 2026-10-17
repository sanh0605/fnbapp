import { saigonToday } from "@/lib/shared/datetime";

export interface StocktakeAlerts {
  stale: { lastConfirmedDay: string | null; lastConfirmedAt: string | null; daysSince: number | null } | null; // null = no alert
  openTooLong: Array<{ id: string; openedDay: string; openedAt: string; daysOpen: number }>;
}

function saigonDay(iso: string): string {
  return saigonToday(new Date(iso));
}

/** Whole calendar days from `from` to `to`, both "YYYY-MM-DD". */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function computeStocktakeAlerts(input: {
  today: string;
  staleDays: number;
  openDays: number;
  sessions: Array<{ id: string; status: string; created_at: string; confirmed_at: string | null; reversed_at: string | null }>;
}): StocktakeAlerts {
  const { today, staleDays, openDays, sessions } = input;

  let lastConfirmedAt: string | null = null;
  for (const s of sessions) {
    if (s.status !== "CONFIRMED" || s.reversed_at || !s.confirmed_at) continue;
    if (lastConfirmedAt === null || Date.parse(s.confirmed_at) > Date.parse(lastConfirmedAt)) lastConfirmedAt = s.confirmed_at;
  }

  let stale: StocktakeAlerts["stale"] = null;
  if (lastConfirmedAt === null) {
    stale = { lastConfirmedDay: null, lastConfirmedAt: null, daysSince: null };
  } else {
    const lastConfirmedDay = saigonDay(lastConfirmedAt);
    const daysSince = daysBetween(lastConfirmedDay, today);
    if (daysSince > staleDays) stale = { lastConfirmedDay, lastConfirmedAt, daysSince };
  }

  const openTooLong = sessions
    .filter((s) => s.status === "OPEN")
    .map((s) => {
      const openedDay = saigonDay(s.created_at);
      return { id: s.id, openedDay, openedAt: s.created_at, daysOpen: daysBetween(openedDay, today) };
    })
    .filter((s) => s.daysOpen > openDays)
    .sort((a, b) => a.openedDay.localeCompare(b.openedDay) || a.id.localeCompare(b.id));

  return { stale, openTooLong };
}

export function negativeStockItems(
  onHand: Map<string, number>,
  names: Map<string, string>,
): Array<{ id: string; name: string; qty: number }> {
  const out: Array<{ id: string; name: string; qty: number }> = [];
  for (const [id, qty] of onHand) {
    if (qty < 0) out.push({ id, name: names.get(id) ?? id, qty });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
