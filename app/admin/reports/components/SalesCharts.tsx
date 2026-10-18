"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/shared/format";
import { formatMonthLabel, formatVnDay } from "@/lib/shared/datetime";

export default function SalesCharts({ 
  salesByDate, 
  salesByDayOfWeek, 
  salesByHour,
  salesByMonth
}: { 
  salesByDate: { label: string, amount: number }[];
  salesByDayOfWeek: { label: string, amount: number }[];
  salesByHour: { label: string, amount: number }[];
  salesByMonth: { label: string, amount: number }[];
}) {
  const [viewMode, setViewMode] = useState<"HOUR" | "DOW" | "DATE" | "MONTH">("HOUR");

  let activeData = salesByHour;
  if (viewMode === "DOW") activeData = salesByDayOfWeek;
  if (viewMode === "DATE") activeData = salesByDate;
  if (viewMode === "MONTH") activeData = salesByMonth;

  const maxAmount = Math.max(...activeData.map(d => d.amount), 1);
  const totalItems = activeData.length;
  // Calculate label interval dynamically to prevent overlapping labels
  let labelInterval = 1;
  if (totalItems > 30) {
    labelInterval = 5;
  } else if (totalItems > 15) {
    labelInterval = 2;
  }

  return (
    <div className="xl:col-span-2 bg-surface-card rounded-card p-6 shadow-sm border border-border flex flex-col min-h-[400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h3 className="font-bold text-text-primary">Biểu đồ doanh thu</h3>
        <div className="flex bg-page p-1 rounded-lg border border-border/50 overflow-x-auto max-w-full">
          <button 
            onClick={() => setViewMode("HOUR")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 min-h-[48px] md:min-h-[40px] inline-flex items-center justify-center ${viewMode === "HOUR" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo giờ
          </button>
          <button 
            onClick={() => setViewMode("DOW")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 min-h-[48px] md:min-h-[40px] inline-flex items-center justify-center ${viewMode === "DOW" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo thứ
          </button>
          <button 
            onClick={() => setViewMode("DATE")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 min-h-[48px] md:min-h-[40px] inline-flex items-center justify-center ${viewMode === "DATE" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo ngày
          </button>
          <button 
            onClick={() => setViewMode("MONTH")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 min-h-[48px] md:min-h-[40px] inline-flex items-center justify-center ${viewMode === "MONTH" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo tháng
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 overflow-x-auto pb-4 mt-auto">
        {activeData.map((d, i) => {
          const heightPercent = (d.amount / maxAmount) * 100;

          // Determine if label should be shown
          const showLabel = i % labelInterval === 0 || i === totalItems - 1;
          const isTooCloseToLast = (totalItems - 1 - i) < labelInterval && i !== totalItems - 1;
          const desktopShow = showLabel && !isTooCloseToLast;
          const phoneShow =
            viewMode === "HOUR"
              ? (i % 3 === 0 && (totalItems - 1 - i >= 3 || i === 0)) || i === totalItems - 1
              : desktopShow;

          const alignClass = totalItems <= 7 ? "" : i === 0 ? "self-start" : i === totalItems - 1 ? "self-end" : "";

          return (
            <div key={i} className="flex flex-col items-center flex-1 group min-w-[8px] sm:min-w-[12px]">
              <div className={`text-xs text-text-secondary mb-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-surface-card px-1 rounded shadow-sm border border-border/50 ${alignClass}`}>
                {formatNumber(Math.round(d.amount / 1000))}k
              </div>
              <div className="w-full max-w-[40px] bg-primary-soft rounded-t-lg relative flex items-end h-[250px]">
                <div 
                  className="w-full bg-primary rounded-t-lg transition-[height] duration-500 ease-out"
                  style={{ height: `${heightPercent}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                ></div>
              </div>
              <div className={`text-xs text-text-muted mt-3 font-medium text-center h-4 ${alignClass}`}>
                <span className={`${phoneShow ? "" : "hidden"} ${desktopShow ? "md:inline" : "md:hidden"}`}>
                  {viewMode === "DATE" ? formatVnDay(d.label).slice(0, 5) : viewMode === "MONTH" ? formatMonthLabel(d.label) : d.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
