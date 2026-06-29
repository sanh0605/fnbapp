import React from "react";

interface ProductTableProps {
  title: string;
  items: any[];
  uniqueSizes: string[];
}

export default function ProductTable({ title, items, uniqueSizes }: ProductTableProps) {
  const totalQtyAll = items.reduce((s, i) => s + i.totalQty, 0);
  const totalRevenueAll = items.reduce((s, i) => s + i.totalRevenue, 0);
  
  const totalQtyBySize: Record<string, number> = {};
  for (const size of uniqueSizes) {
    totalQtyBySize[size] = 0;
  }
  
  for (const item of items) {
    for (const size of uniqueSizes) {
      if (item.sizes[size]) {
        totalQtyBySize[size] += item.sizes[size];
      }
    }
  }

  return (
    <div className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
          Tổng: {totalQtyAll.toLocaleString("vi-VN")}
        </span>
      </div>
      <div className="hidden md:block overflow-x-auto max-h-[528px] overflow-y-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white text-gray-400 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
            <tr>
              <th className="px-4 py-3">Món</th>
              {uniqueSizes.map(size => (
                <th key={size} className="px-4 py-3 text-right">Size {size}</th>
              ))}
              <th className="px-4 py-3 text-right text-gray-700">Tổng SL</th>
              <th className="px-4 py-3 text-right text-gray-700">Tổng Thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 ? (
              <tr><td colSpan={uniqueSizes.length + 3} className="text-center py-8 text-gray-400">Không có giao dịch</td></tr>
            ) : (
              items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  {uniqueSizes.map(size => (
                    <td key={size} className="px-4 py-3 text-right font-medium text-gray-500">
                      {item.sizes[size] ? item.sizes[size] : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{item.totalQty}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{Math.round(item.totalRevenue).toLocaleString("vi-VN")} đ</td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10 font-bold text-gray-900 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
              <tr>
                <td className="px-4 py-3">Tổng cộng</td>
                {uniqueSizes.map(size => (
                  <td key={size} className="px-4 py-3 text-right">
                    {totalQtyBySize[size] > 0 ? totalQtyBySize[size].toLocaleString("vi-VN") : "-"}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">{totalQtyAll.toLocaleString("vi-VN")}</td>
                <td className="px-4 py-3 text-right text-green-700">{Math.round(totalRevenueAll).toLocaleString("vi-VN")} đ</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* Mobile Card Layout (< 768px) */}
      <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[528px] bg-gray-50/30 flex-1">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Không có giao dịch</div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="font-bold text-gray-900">{item.name}</div>
                <div className="font-bold text-green-600 shrink-0">{Math.round(item.totalRevenue).toLocaleString("vi-VN")} đ</div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Tổng SL:</span>
                  <span className="font-semibold text-gray-800">{item.totalQty}</span>
                </div>
                {uniqueSizes.filter(size => item.sizes[size]).map(size => (
                  <div key={size} className="flex items-center gap-1 text-xs">
                    <span className="text-gray-400">Size {size}:</span>
                    <span className="font-medium text-gray-700">{item.sizes[size]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        {items.length > 0 && (
          <div className="mt-2 pt-3 border-t border-gray-200 flex flex-col gap-2">
            <div className="flex justify-between items-center font-bold text-gray-900">
              <span>Tổng cộng</span>
              <span className="text-green-700">{Math.round(totalRevenueAll).toLocaleString("vi-VN")} đ</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                 <span className="text-gray-500">Tổng SL:</span>
                 <span className="font-bold text-gray-800">{totalQtyAll.toLocaleString("vi-VN")}</span>
              </div>
              {uniqueSizes.filter(size => totalQtyBySize[size] > 0).map(size => (
                <div key={size} className="flex items-center gap-1 text-xs">
                  <span className="text-gray-400">Size {size}:</span>
                  <span className="font-medium text-gray-700">{totalQtyBySize[size].toLocaleString("vi-VN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
