import { getSupabaseClient } from "@/lib/db/supabase";
import type { DBCashBookDailyRow } from "@/types/db";

const PAGE_SIZE = 1000;

// Sales and purchase money per Saigon day and method, from the read-only view
// created by migration 0107. A direct read with no cache: sales change every
// minute. Everything up to and including throughDay, because the opening
// balance of a range needs every day before it.
export async function readCashBookDaily(throughDay: string): Promise<DBCashBookDailyRow[]> {
  const supabase = getSupabaseClient();
  const all: DBCashBookDailyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("cash_book_daily")
      .select("source, day, method, bank_account_id, doc_count, amount")
      .lte("day", throughDay)
      // A fixed order, so no row is skipped or repeated between pages.
      .order("day", { ascending: true })
      .order("source", { ascending: true })
      .order("method", { ascending: true })
      .order("bank_account_id", { ascending: true, nullsFirst: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`readCashBookDaily: ${error.message}`);
    for (const row of data ?? []) {
      all.push({
        source: row.source,
        day: row.day,
        method: row.method,
        bank_account_id: row.bank_account_id ?? null,
        // bigint columns may arrive as strings; whole dong either way.
        doc_count: Number(row.doc_count),
        amount: Number(row.amount),
      });
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return all;
}
