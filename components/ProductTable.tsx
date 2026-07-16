import React from "react";
import { formatNumber } from "@/lib/format";

interface ProductTableProps {
  title: string;
  items: any[];
  uniqueSizes: string[];
}

export default function ProductTable({ title, items, uniqueSizes: _propUniqueSizes }: ProductTableProps) {
  const totalQtyAll = items.reduce((s, i) => s + i.totalQty, 0);
  const totalRevenueAll = items.reduce((s, i) => s + i.totalRevenue, 0);
  
  // 1. Find all distinct sizes present in these specific items
  const sizeSet = new Set<string>();
  items.forEach(item => {
    Object.keys(item.sizes || {}).forEach(size => sizeSet.add(size));
  });
  
  let tableUniqueSizes = Array.from(sizeSet).sort();
  // 2. If there is only 1 size (or none), do not separate quantity by size
  if (tableUniqueSizes.length <= 1) {
    tableUniqueSizes = [];
  }

  const totalQtyBySize: Record<string, number> = {};
  for (const size of tableUniqueSizes) {
    totalQtyBySize[size] = 0;
  }
  
  for (const item of items) {
    for (const size of tableUniqueSizes) {
      if (item.sizes[size]) {
        totalQtyBySize[size] += item.sizes[size];
      }
    }
  }

  return (
    <div className="xl:col-span-1 bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-border bg-page/50 flex justify-between items-center">
        <h3 className="font-bold text-text-primary">{title}</h3>
        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
          Tổng: {totalQtyAll.toLocaleString("vi-VN")}
        </span>
      </div>
      <div className="hidden md:block overflow-x-auto max-h-[528px] overflow-y-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface-card text-text-muted font-medium sticky top-0 border-b border-border shadow-sm z-10">
            <tr>
              <th className="px-4 py-3">Món</th>
              {tableUniqueSizes.map(size => (
                <th key={size} className="px-4 py-3 text-right">Size {size}</th>
              ))}
              <th className="px-4 py-3 text-right text-text-primary">Tổng SL</th>
              <th className="px-4 py-3 text-right text-text-primary">Tổng Thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 ? (
              <tr><td colSpan={tableUniqueSizes.length + 3} className="text-center py-8 text-text-muted">Không có giao dịch</td></tr>
            ) : (
              items.map((item, i) => (
                <tr key={i} className="hover:bg-page transition">
                  <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                  {tableUniqueSizes.map(size => (
                    <td key={size} className="px-4 py-3 text-right font-medium text-text-secondary">
                      {item.sizes[size] ? item.sizes[size] : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-text-primary">{item.totalQty}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{formatNumber(Math.round(item.totalRevenue))}</td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-page border-t-2 border-border sticky bottom-0 z-10 font-bold text-text-primary shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
              <tr>
                <td className="px-4 py-3">Tổng cộng</td>
                {tableUniqueSizes.map(size => (
                  <td key={size} className="px-4 py-3 text-right">
                    {totalQtyBySize[size] > 0 ? totalQtyBySize[size].toLocaleString("vi-VN") : "-"}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">{totalQtyAll.toLocaleString("vi-VN")}</td>
                <td className="px-4 py-3 text-right text-green-700">{formatNumber(Math.round(totalRevenueAll))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* Mobile Card Layout (< 768px) */}
      <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[528px] bg-page/30 flex-1">
        {items.length === 0 ? (
          <div className="text-center py-8 text-text-muted">Không có giao dịch</div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="bg-surface-card rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="font-bold text-text-primary">{item.name}</div>
                <div className="font-bold text-green-600 shrink-0">{formatNumber(Math.round(item.totalRevenue))}</div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
                <div className="flex items-center gap-1">
                  <span className="text-text-muted">Tổng SL:</span>
                  <span className="font-semibold text-text-primary">{item.totalQty}</span>
                </div>
                {tableUniqueSizes.filter(size => item.sizes[size]).map(size => (
                  <div key={size} className="flex items-center gap-1 text-xs">
                    <span className="text-text-muted">Size {size}:</span>
                    <span className="font-medium text-text-primary">{item.sizes[size]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        {items.length > 0 && (
          <div className="mt-2 pt-3 border-t border-border flex flex-col gap-2">
            <div className="flex justify-between items-center font-bold text-text-primary">
              <span>Tổng cộng</span>
              <span className="text-green-700">{formatNumber(Math.round(totalRevenueAll))}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
              <div className="flex items-center gap-1">
                 <span className="text-text-secondary">Tổng SL:</span>
                 <span className="font-bold text-text-primary">{totalQtyAll.toLocaleString("vi-VN")}</span>
              </div>
              {tableUniqueSizes.filter(size => totalQtyBySize[size] > 0).map(size => (
                <div key={size} className="flex items-center gap-1 text-xs">
                  <span className="text-text-muted">Size {size}:</span>
                  <span className="font-medium text-text-primary">{totalQtyBySize[size].toLocaleString("vi-VN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
