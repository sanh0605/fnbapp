"use client";

import { useFilterForm } from "@/lib/use-filter-form";

export default function BackdatedLedgerClient() {
  const { draft, setField, applyFilters, isPending } = useFilterForm({
    status: "PENDING",
    item_reference: "",
    source_table: "ALL",
  });

  return (
    <div className="bg-surface-card p-4 rounded-lg shadow mb-6 border border-border grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Trạng thái</label>
        <select
          value={draft.status}
          onChange={(e) => setField("status", e.target.value)}
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
          value={draft.source_table}
          onChange={(e) => setField("source_table", e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm bg-surface-card"
        >
          <option value="ALL">Tất cả</option>
          <option value="purchase_orders">Purchase Orders</option>
          <option value="stock_adjustments">Stock Adjustments</option>
          <option value="production_yields">Production Yields</option>
          <option value="recipes">Recipes</option>
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Item Reference</label>
          <input
            type="text"
            value={draft.item_reference}
            onChange={(e) => setField("item_reference", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Ví dụ: NNL-007"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <button
          onClick={() => applyFilters()}
          disabled={isPending}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium disabled:opacity-60 whitespace-nowrap"
        >
          {isPending ? "Đang lọc..." : "Lọc"}
        </button>
      </div>
    </div>
  );
}
