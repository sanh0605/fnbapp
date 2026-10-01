"use client";

import { buildPriceHistoryTimeline } from "@/lib/products/price-history";
import { formatNumber } from "@/lib/shared/format";

interface PriceHistoryViewProps {
  priceHistory: any[];
  productName?: string;
}

export function PriceHistoryView({ priceHistory }: PriceHistoryViewProps) {
  const priceTimeline = buildPriceHistoryTimeline(priceHistory || []);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "Hiện tại";
    const d = new Date(isoStr);
    const dd = d.getDate().toString().padStart(2, "0");
    const MM = (d.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    const ss = d.getSeconds().toString().padStart(2, "0");
    return `${dd}/${MM}/${yyyy} ${hh}:${mm}:${ss}`;
  };

  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl border border-border p-8 text-center text-text-secondary italic">
        Chưa có lịch sử thay đổi nào.
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <h3 className="text-lg font-bold text-text-primary mb-6 border-b border-border pb-3">
        Lịch sử Giá Bán
      </h3>
      <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {priceTimeline.map((entry) => (
          <div
            key={entry.id}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-warning text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
            <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 bg-surface-card rounded-lg shadow-sm border border-border">
              <div className="text-xs font-bold text-text-muted mb-1">
                Từ: {formatDate(entry.effectiveAt)}
                <br />
                Đến: {formatDate(entry.endAt || "")}
              </div>
              <div className="font-bold text-primary text-base">
                {formatNumber(entry.newPrice)}
              </div>
              {entry.isCurrent && (
                <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-medium bg-success/10 text-success">
                  Đang áp dụng
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PriceHistoryView;
