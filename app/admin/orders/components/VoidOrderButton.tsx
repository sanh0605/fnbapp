"use client";

import { Button } from "@/components/ui/Button";

// Huỷ đơn is its own page (BR-DATA-007); this only links to it.
export function VoidOrderButton({ orderId, returnTo }: { orderId: string; returnTo?: string }) {
  const href = `/admin/orders/${encodeURIComponent(orderId)}/void${
    returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
  }`;
  return (
    <Button href={href} variant="delete">
      Huỷ đơn
    </Button>
  );
}
