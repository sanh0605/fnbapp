import { saigonToday } from "@/lib/shared/datetime";

export interface MonthlyReminder {
  itemId: string;
  itemName: string;
  month: string; // "YYYY-MM"
  cashCategoryId: string;
}

function nextMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Months still owed: active items, from the creation month (Saigon) up to the current month. */
export function computeMonthlyReminders(input: {
  today: string; // "YYYY-MM-DD" Saigon
  reminderStartDay: number; // 1-28
  items: Array<{ id: string; name: string; cash_category_id: string; status: string; created_at: string }>;
  entries: Array<{ monthly_item_id: string | null; entry_date: string; status: string }>;
}): MonthlyReminder[] {
  const { today, reminderStartDay, items, entries } = input;
  const currentMonth = today.slice(0, 7);
  const todayDay = Number(today.slice(8, 10));

  const covered = new Set<string>();
  for (const e of entries) {
    if (e.monthly_item_id && e.status !== "CANCELLED") covered.add(`${e.monthly_item_id}|${e.entry_date.slice(0, 7)}`);
  }

  const out: MonthlyReminder[] = [];
  for (const item of items) {
    if (item.status !== "ACTIVE") continue;
    const createdMonth = saigonToday(new Date(item.created_at)).slice(0, 7);
    for (let m = createdMonth; m <= currentMonth; m = nextMonth(m)) {
      if (m === currentMonth && todayDay < reminderStartDay) continue;
      if (covered.has(`${item.id}|${m}`)) continue;
      out.push({ itemId: item.id, itemName: item.name, month: m, cashCategoryId: item.cash_category_id });
    }
  }
  return out.sort((a, b) => a.month.localeCompare(b.month) || a.itemName.localeCompare(b.itemName, "vi"));
}
