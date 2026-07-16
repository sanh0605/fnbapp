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
    wrapper: "bg-primary/10 border-primary/20",
    dot: "bg-cyan-400 animate-pulse",
    text: "text-cyan-400",
  },
  manualItem: {
    wrapper: "bg-orange-500/10 border-orange-500/20",
    dot: "bg-orange-400",
    text: "text-orange-400",
  },
  order: {
    wrapper: "bg-rose-500/10 border-rose-500/20",
    dot: "bg-rose-400",
    text: "text-rose-400",
  },
};

import { formatNumber } from "@/lib/format";

export function DiscountBadge({ kind, label, amount }: DiscountBadgeProps) {
  if (amount <= 0) return null;
  const c = KIND_CLASSES[kind];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${c.wrapper}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span className={`text-[10px] font-bold uppercase ${c.text}`}>
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
