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
      <span className="text-sm font-medium text-gray-700 w-28">Giảm giá đơn:</span>
      <div className="flex items-center gap-2 flex-1">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => setOrderDiscountType("VND")}
            className={`px-2 py-1 text-xs font-bold ${
              orderDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"
            }`}
          >
            VND
          </button>
          <button
            type="button"
            onClick={() => setOrderDiscountType("PERCENT")}
            className={`px-2 py-1 text-xs font-bold ${
              orderDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"
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
          className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
