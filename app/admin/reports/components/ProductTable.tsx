import React from "react";
import { formatNumber } from "@/lib/shared/format";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";

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
        <span className="text-xs font-medium bg-primary-soft text-primary px-2 py-1 rounded">
          Tổng: {formatNumber(totalQtyAll)}
        </span>
      </div>
      <div className="hidden md:block">
        <Table pinHead>
          <TableHead>
            <TableHeaderCell>Món</TableHeaderCell>
            {tableUniqueSizes.map(size => (
              <TableHeaderCell key={size}>Size {size}</TableHeaderCell>
            ))}
            <TableHeaderCell>Tổng SL</TableHeaderCell>
            <TableHeaderCell>Tổng thu</TableHeaderCell>
          </TableHead>
          {items.length > 0 && (
            <TableTotalRow>
              <TableCell>Tổng cộng</TableCell>
              {tableUniqueSizes.map(size => (
                <TableCell key={size} align="right">
                  {totalQtyBySize[size] > 0 ? formatNumber(totalQtyBySize[size]) : "-"}
                </TableCell>
              ))}
              <TableCell align="right">{formatNumber(totalQtyAll)}</TableCell>
              <TableCell align="right">{formatNumber(Math.round(totalRevenueAll))}</TableCell>
            </TableTotalRow>
          )}
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableUniqueSizes.length + 3}>
                  <div className="text-center py-8 text-text-muted">Không có giao dịch</div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.name}</TableCell>
                  {tableUniqueSizes.map(size => (
                    <TableCell key={size} align="right">
                      {item.sizes[size] ? item.sizes[size] : "-"}
                    </TableCell>
                  ))}
                  <TableCell align="right">{item.totalQty}</TableCell>
                  <TableCell align="right">{formatNumber(Math.round(item.totalRevenue))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Mobile Card Layout (< 768px) */}
      <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[528px] bg-page/30 flex-1">
        {items.length > 0 && (
          <div className="pb-3 border-b border-border flex flex-col gap-2">
            <div className="flex justify-between items-center font-bold text-text-primary">
              <span>Tổng cộng</span>
              <span className="text-text-primary">{formatNumber(Math.round(totalRevenueAll))}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
              <div className="flex items-center gap-1">
                 <span className="text-text-secondary">Tổng SL:</span>
                 <span className="font-bold text-text-primary">{formatNumber(totalQtyAll)}</span>
              </div>
              {tableUniqueSizes.filter(size => totalQtyBySize[size] > 0).map(size => (
                <div key={size} className="flex items-center gap-1 text-xs">
                  <span className="text-text-muted">Size {size}:</span>
                  <span className="font-medium text-text-primary">{formatNumber(totalQtyBySize[size])}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <div className="text-center py-8 text-text-muted">Không có giao dịch</div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="bg-surface-card rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="font-bold text-text-primary">{item.name}</div>
                <div className="font-bold text-text-primary shrink-0">{formatNumber(Math.round(item.totalRevenue))}</div>
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
      </div>
    </div>
  );
}
