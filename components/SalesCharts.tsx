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
    <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-gray-900">Biểu đồ Doanh Thu</h3>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode("HOUR")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "HOUR" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Theo Giờ
          </button>
          <button 
            onClick={() => setViewMode("DOW")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "DOW" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Theo Thứ
          </button>
          <button 
            onClick={() => setViewMode("DATE")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "DATE" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Theo Ngày
          </button>
          <button 
            onClick={() => setViewMode("MONTH")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === "MONTH" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
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
              <div className="text-xs text-gray-500 mb-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-white px-1 rounded shadow-sm">
                {(d.amount / 1000).toLocaleString()}k
              </div>
              <div className="w-full max-w-[40px] bg-blue-50 rounded-t-lg relative flex items-end h-[250px]">
                <div 
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-500 ease-out"
                  style={{ height: `${heightPercent}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                ></div>
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-3 font-medium text-center h-4">
                {shouldShowLabel ? d.label : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
