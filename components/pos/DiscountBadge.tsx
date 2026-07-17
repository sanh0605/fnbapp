/**
 * Discount display badges for POS cart.
 *
 * 3-color scheme distinguishes the 3 discount types in V2 data model:
 * - Cyan: System promo (line.promo_discount)
 * - Orange: Manual item discount (line.manual_item_discount)
 * - Rose: Order-level discount (line.order_discount_allocation)
 */

type DiscountKind = "promo" | "manualItem" | "order";

interface DiscountBadgeProps {
  kind: DiscountKind;
  label: string;
  amount: number;
}

const KIND_CLASSES: Record<DiscountKind, { wrapper: string; dot: string; text: string }> = {
  promo: {
    wrapper: "bg-primary-soft border-primary/10",
    dot: "bg-primary animate-pulse",
    text: "text-primary",
  },
  manualItem: {
    wrapper: "bg-primary-soft/80 border-primary/10",
    dot: "bg-primary/70",
    text: "text-primary/90",
  },
  order: {
    wrapper: "bg-primary-soft/60 border-primary/10",
    dot: "bg-primary/50",
    text: "text-primary/80",
  },
};

import { formatNumber } from "@/lib/format";

export function DiscountBadge({ kind, label, amount }: DiscountBadgeProps) {
  if (amount <= 0) return null;
  const c = KIND_CLASSES[kind];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${c.wrapper}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      <span className={`text-[10px] font-semibold uppercase ${c.text}`}>
        {label}: −{formatNumber(amount)}
      </span>
    </div>
  );
}

export const DISCOUNT_KIND = {
  PROMO: "promo" as const,
  MANUAL_ITEM: "manualItem" as const,
  ORDER: "order" as const,
};
