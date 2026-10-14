"use client";

import { NumberInput } from "@/components/ui/NumberInput";

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
  const isPercent = orderDiscountType === "PERCENT";

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
        <div className="flex-1">
          <NumberInput
            id="order-discount"
            aria-label="Số tiền giảm giá đơn hàng"
            decimals={isPercent ? 2 : 0}
            unit={isPercent ? "%" : "đ"}
            max={isPercent ? 100 : undefined}
            example={isPercent ? "10" : "10,000"}
            min={0}
            value={orderDiscount ? orderDiscount : null}
            onValueChange={(v) => setOrderDiscount(v ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}
