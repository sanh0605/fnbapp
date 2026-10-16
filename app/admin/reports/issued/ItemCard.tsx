import { formatNumber } from "@/lib/shared/format";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableRowHeader,
  TableCell,
} from "@/components/ui/Table";

// Extracted from page.tsx (not left inline) so it can be unit-rendered
// directly (OPEN-ITEMS 38/41) -- Next.js's route-module type constraint
// only allows a fixed set of named exports from a page.tsx file, so an
// exported helper component has to live in its own module.
export function ItemCard({
  name,
  unitName,
  issuedQuantity,
  issuedValue,
  closingValue,
}: {
  name: string;
  unitName: string;
  issuedQuantity: number;
  issuedValue: number;
  closingValue: number;
}) {
  return (
    <Table>
      <TableHead>
        <TableHeaderCell stick="left">Nguyên liệu</TableHeaderCell>
        <TableHeaderCell>Đã xuất</TableHeaderCell>
        <TableHeaderCell>Giá trị đã xuất</TableHeaderCell>
        <TableHeaderCell>Giá trị tồn còn lại</TableHeaderCell>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableRowHeader stick="left">{name}</TableRowHeader>
          <TableCell align="right">
            {formatNumber(issuedQuantity, { withDecimals: true })} {unitName}
          </TableCell>
          <TableCell align="right" tone="negative">
            {formatNumber(issuedValue)}đ
          </TableCell>
          <TableCell align="right">
            {formatNumber(closingValue)}đ
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
