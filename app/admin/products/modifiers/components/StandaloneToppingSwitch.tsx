"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleToppingStandalone } from "@/app/admin/products/toppings/actions";
import { createStandaloneToppingAction } from "../actions";
import { alert, confirm } from "@/lib/shared/dialog";
import { formatNumber } from "@/lib/shared/format";

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 1 + Task 2 +
// Task 3. One switch, three states (plan question 1): (a)/(b) an already
// linked modifier toggles its product ACTIVE/INACTIVE directly, same as
// ToppingsManager.tsx's existing pattern; (c) an unlinked modifier asks for
// confirmation, then creates the product+variant+link in one transaction
// (migration 0100). No switch renders at all outside the Thêm Topping group
// (state d) -- Chọn Size/Đường/Đá are choices inside a drink, not toppings.
// Shared between ModifiersClient.tsx's merged table (Task 1) and
// ModifierForm.tsx's own labelled section (Task 3) so both write paths stay
// identical instead of drifting into two switches with different bugs.
const STANDALONE_ELIGIBLE_GROUP = "Thêm Topping";

interface StandaloneToppingSwitchProps {
  modifierId: string;
  modifierName: string;
  groupName: string;
  price: string | number;
  productId: string | null;
  productStatus?: string;
}

export function StandaloneToppingSwitch({
  modifierId,
  modifierName,
  groupName,
  price,
  productId,
  productStatus,
}: StandaloneToppingSwitchProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (groupName !== STANDALONE_ELIGIBLE_GROUP) return null;

  const isLinked = Boolean(productId);
  const isActive = isLinked && productStatus === "ACTIVE";

  async function handleToggle() {
    setPending(true);
    if (isLinked) {
      const res = await toggleToppingStandalone(productId as string, !isActive);
      if (!res.ok) {
        await alert({
          title: "Lỗi",
          message: res.error || "Có lỗi xảy ra khi bật/tắt bán độc lập.",
          variant: "danger",
        });
      }
    } else {
      const confirmed = await confirm({
        title: "Tạo món bán riêng",
        message: `Tạo món "${modifierName}" bán riêng giá ${formatNumber(price)}đ?`,
      });
      if (confirmed) {
        const res = await createStandaloneToppingAction(modifierId);
        if (!res.success) {
          await alert({
            title: "Không tạo được",
            message: res.error || "Có lỗi xảy ra khi tạo món bán riêng.",
            variant: "danger",
          });
        }
      }
    }
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      disabled={pending}
      onClick={handleToggle}
      className="relative flex h-[44px] w-[60px] items-center justify-center disabled:opacity-50 focus:outline-none"
      aria-label={`Bật/tắt bán độc lập cho ${modifierName}`}
    >
      <div
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isActive ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
            isActive ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </div>
    </button>
  );
}
