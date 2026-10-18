"use client";

import { useEffect, useRef, useState } from "react";
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

  const chartRef = useRef<HTMLDivElement>(null);
  // Measured width of the bars box; 263 is a 360 px phone (also used before the first measure).
  const [chartWidth, setChartWidth] = useState(263);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let activeData = salesByHour;
  if (viewMode === "DOW") activeData = salesByDayOfWeek;
  if (viewMode === "DATE") activeData = salesByDate;
  if (viewMode === "MONTH") activeData = salesByMonth;

  const maxAmount = Math.max(...activeData.map(d => d.amount), 1);
  const totalItems = activeData.length;
  // Each column is chartWidth / totalItems wide. Labels (day/hour ~40 px, month ~55 px) stay 4 px apart; when a label is wider than its column, the first and last move to the column edge so they stay inside the chart.
  const labelW = viewMode === "MONTH" ? 55 : viewMode === "DOW" ? 20 : 40;
  const pitch = chartWidth / Math.max(totalItems, 1);
  const labelStep = Math.ceil(Math.max((labelW + 4) / pitch, (1.5 * labelW + 4) / pitch - 0.5));
  const edgeLabels = labelW > pitch;

  return (
    <div className="xl:col-span-2 bg-surface-card rounded-card p-6 shadow-sm border border-border flex flex-col min-h-[400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h3 className="font-bold text-text-primary">Biểu đồ doanh thu</h3>
        <div className="flex bg-page p-1 rounded-lg border border-border/50 overflow-x-auto max-w-full hide-scrollbar">
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
      
      <div ref={chartRef} className="flex-1 flex items-end overflow-x-clip pb-4 mt-auto">
        {activeData.map((d, i) => {
          const heightPercent = (d.amount / maxAmount) * 100;

          const showLabel = (i % labelStep === 0 && (totalItems - 1 - i >= labelStep || i === 0)) || i === totalItems - 1;
          const alignClass = !edgeLabels ? "" : i === 0 ? "self-start" : i === totalItems - 1 ? "self-end" : "";
          // The value box (up to ~70 px, e.g. "19,236k") moves to its column's edge when centring it would push it out of the chart.
          const centre = (i + 0.5) * pitch;
          const valueAlign = centre < 36 ? "self-start" : chartWidth - centre < 36 ? "self-end" : "";

          return (
            <div key={i} className="flex flex-col items-center flex-1 group min-w-0">
              <div className={`text-xs text-text-secondary mb-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-surface-card px-1 rounded shadow-sm border border-border/50 ${valueAlign}`}>
                {formatNumber(Math.round(d.amount / 1000))}k
              </div>
              <div className="w-3/4 max-w-[40px] bg-primary-soft rounded-t-lg relative flex items-end h-[250px]">
                <div 
                  className="w-full bg-primary rounded-t-lg transition-[height] duration-500 ease-out"
                  style={{ height: `${heightPercent}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                ></div>
              </div>
              <div className={`text-xs text-text-muted mt-3 font-medium text-center h-4 ${alignClass}`}>
                <span className={showLabel ? "" : "hidden"}>
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
