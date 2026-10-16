import React from "react";
import { formatNumber } from "@/lib/shared/format";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
  TableRowHeader,
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
      <Table pinHead>
        <TableHead>
          <TableHeaderCell stick="left">Món</TableHeaderCell>
          {tableUniqueSizes.map(size => (
            <TableHeaderCell key={size}>Size {size}</TableHeaderCell>
          ))}
          <TableHeaderCell>Tổng SL</TableHeaderCell>
          <TableHeaderCell>Tổng thu</TableHeaderCell>
        </TableHead>
        {items.length > 0 && (
          <TableTotalRow>
            <TableCell stick="left">Tổng cộng</TableCell>
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
                <TableRowHeader stick="left">{item.name}</TableRowHeader>
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
  );
}
