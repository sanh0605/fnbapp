"use server";

import { findAllWhere } from "@/lib/sheets_db";
import { requireAdmin } from "@/lib/auth";

const PAGE_SIZE = 30;

export interface StockLedgerHistoryRow {
  id: string;
  transactionType: string;
  quantityChange: number;
  referenceId: string;
  notes: string;
  createdAt: string;
}

export interface StockLedgerHistoryPage {
  rows: StockLedgerHistoryRow[];
  nextCursor: { value: string; id: string } | null;
}

/**
 * Paginated newest-first Stock_Ledger drill-down for one item. Cursor-based
 * (not offset) because Stock_Ledger has 11,700+ rows and is indexed on
 * (item_reference, created_at) -- see supabase/migrations/0001_init_schema.sql.
 */
export async function getItemStockLedgerHistory(
  itemId: string,
  cursor?: { value: string; id: string },
): Promise<StockLedgerHistoryPage> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const rows = await findAllWhere<{
    id: string;
    transaction_type: string;
    quantity_change: string | number;
    reference_id?: string;
    notes?: string;
    created_at: string;
  }>("Stock_Ledger", {
    eq: { item_reference: itemId },
    order: { column: "created_at", ascending: false },
    limit: PAGE_SIZE,
    after: cursor,
  });

  const nextCursor = rows.length === PAGE_SIZE
    ? { value: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id }
    : null;

  return {
    rows: rows.map(row => ({
      id: row.id,
      transactionType: row.transaction_type,
      quantityChange: Number(row.quantity_change) || 0,
      referenceId: row.reference_id || "",
      notes: row.notes || "",
      createdAt: row.created_at,
    })),
    nextCursor,
  };
}
