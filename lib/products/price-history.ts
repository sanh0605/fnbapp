export type PriceHistoryRecord = {
  id: string;
  variant_id: string;
  old_price: string | number | null;
  new_price: string | number;
  effective_at: string;
  created_at: string;
};

export type PriceHistoryTimelineEntry = {
  id: string;
  variantId: string;
  oldPrice: number | null;
  newPrice: number;
  effectiveAt: string;
  endAt: string | null;
  isCurrent: boolean;
};

export function buildPriceHistoryTimeline(
  records: PriceHistoryRecord[],
): PriceHistoryTimelineEntry[] {
  const sorted = [...records].sort((left, right) => {
    const effectiveDelta = new Date(right.effective_at).getTime()
      - new Date(left.effective_at).getTime();
    if (effectiveDelta !== 0) return effectiveDelta;
    return String(right.id).localeCompare(String(left.id));
  });

  return sorted.map((record, index) => ({
    id: record.id,
    variantId: record.variant_id,
    oldPrice: record.old_price === null || record.old_price === ""
      ? null
      : Number(record.old_price),
    newPrice: Number(record.new_price),
    effectiveAt: record.effective_at,
    endAt: index === 0 ? null : sorted[index - 1].effective_at,
    isCurrent: index === 0,
  }));
}
