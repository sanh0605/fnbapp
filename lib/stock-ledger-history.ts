// WF-2: per-item Stock_Ledger drill-down. Vietnamese labels for the
// transaction_type enum (supabase/migrations/0001_init_schema.sql check
// constraint on stock_ledger.transaction_type is the source of truth).

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  SALES_CONSUME: "Bán hàng",
  EDIT_REVERSAL: "Hoàn tác sửa đơn",
  EDIT_CONSUME: "Sửa đơn - trừ kho",
  PO_RECEIPT: "Nhập hàng",
  PRODUCTION_CONSUME: "Sản xuất - trừ nguyên liệu",
  PRODUCTION_YIELD: "Sản xuất - nhập thành phẩm",
  STOCK_ADJUST: "Điều chỉnh tồn kho",
  ADJUSTMENT_IN: "Điều chỉnh tăng",
  ADJUSTMENT_OUT: "Điều chỉnh giảm",
};

export function getTransactionTypeLabel(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}
