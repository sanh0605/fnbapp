"use client";

interface DiscountEditorProps {
  orderDiscount: number;
  orderDiscountType: string;
  setOrderDiscount: (val: number) => void;
  setOrderDiscountType: (type: string) => void;
}

export function DiscountEditor({
  orderDiscount,
  orderDiscountType,
  setOrderDiscount,
  setOrderDiscountType,
}: DiscountEditorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-text-secondary w-28">Giảm giá đơn:</span>
      <div className="flex items-center gap-2 flex-1">
        <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
          <button
            type="button"
            onClick={() => setOrderDiscountType("VND")}
            className={`px-2 py-1 text-xs font-bold ${
              orderDiscountType === "VND" ? "bg-primary-soft text-primary" : "bg-surface-card text-text-muted hover:bg-page"
            }`}
          >
            VND
          </button>
          <button
            type="button"
            onClick={() => setOrderDiscountType("PERCENT")}
            className={`px-2 py-1 text-xs font-bold ${
              orderDiscountType === "PERCENT" ? "bg-primary-soft text-primary" : "bg-surface-card text-text-muted hover:bg-page"
            }`}
          >
            %
          </button>
        </div>
        <input
          type="number"
          min="0"
          value={orderDiscount || ""}
          onChange={(e) => setOrderDiscount(Number(e.target.value))}
          className="flex-1 px-2 py-1 border border-border rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-focus-ring bg-surface-card text-text-primary"
        />
      </div>
    </div>
  );
}
