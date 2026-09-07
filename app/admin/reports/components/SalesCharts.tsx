"use client";

import { useState } from "react";

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
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-text-primary">Biểu đồ Doanh Thu</h3>
        <div className="flex bg-page p-1 rounded-lg border border-border/50">
          <button 
            onClick={() => setViewMode("HOUR")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "HOUR" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo Giờ
          </button>
          <button 
            onClick={() => setViewMode("DOW")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "DOW" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo Thứ
          </button>
          <button 
            onClick={() => setViewMode("DATE")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "DATE" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo Ngày
          </button>
          <button 
            onClick={() => setViewMode("MONTH")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "MONTH" ? "bg-surface-card shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Theo Tháng
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 overflow-x-auto pb-4 mt-auto">
        {activeData.map((d, i) => {
          const heightPercent = (d.amount / maxAmount) * 100;

          // Determine if label should be shown
          const showLabel = i % labelInterval === 0 || i === totalItems - 1;
          const isTooCloseToLast = (totalItems - 1 - i) < labelInterval && i !== totalItems - 1;
          const shouldShowLabel = showLabel && !isTooCloseToLast;

          return (
            <div key={i} className="flex flex-col items-center flex-1 group min-w-[8px] sm:min-w-[12px]">
              <div className="text-xs text-text-secondary mb-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-surface-card px-1 rounded shadow-sm border border-border/50">
                {Math.round(d.amount / 1000).toLocaleString("vi-VN")}k
              </div>
              <div className="w-full max-w-[40px] bg-primary-soft rounded-t-lg relative flex items-end h-[250px]">
                <div 
                  className="w-full bg-primary rounded-t-lg transition-[height] duration-500 ease-out"
                  style={{ height: `${heightPercent}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                ></div>
              </div>
              <div className="text-[10px] sm:text-xs text-text-muted mt-3 font-medium text-center h-4">
                {shouldShowLabel ? d.label : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
