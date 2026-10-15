// BR-CATALOG-007: a stopped supplier or item is not offered on a new purchase order,
// but an order that already names it keeps showing it.
export function activeOrOnOrder<T extends { id: string; status?: string }>(rows: T[], onOrderIds: Iterable<string>): T[] {
  const keep = new Set(onOrderIds);
  return rows.filter(r => r.status !== "INACTIVE" || keep.has(r.id));
}
