"use client";

import { useUrlState } from "@/lib/use-url-state";

export default function BackdatedLedgerClient() {
  const [status, setStatus] = useUrlState<string>("status", "PENDING");
  const [itemRef, setItemRef] = useUrlState<string>("item_reference", "");
  const [sourceTable, setSourceTable] = useUrlState<string>("source_table", "ALL");

  return (
    <div className="bg-surface-card p-4 rounded-lg shadow mb-6 border border-border grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Trạng thái</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm bg-surface-card"
        >
          <option value="ALL">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="RECOMPUTED">Đã tính lại</option>
          <option value="REJECTED">Đã từ chối</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Source Table</label>
        <select
          value={sourceTable}
          onChange={(e) => setSourceTable(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm bg-surface-card"
        >
          <option value="ALL">Tất cả</option>
          <option value="purchase_orders">Purchase Orders</option>
          <option value="stock_adjustments">Stock Adjustments</option>
          <option value="production_yields">Production Yields</option>
          <option value="recipes">Recipes</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Item Reference</label>
        <input
          type="text"
          value={itemRef}
          onChange={(e) => setItemRef(e.target.value)}
          placeholder="Ví dụ: NNL-007"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>
    </div>
  );
}
