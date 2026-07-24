"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomDatePicker } from "@/components/CustomDatePicker";

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DailyDigestFilter({ date }: { date: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goToDate = (value: Date | null) => {
    if (!value) return;
    startTransition(() => {
      router.push(`?date=${toDateOnly(value)}`);
    });
  };

  return (
    <PageHeader
      title="Tổng Kết Ngày"
      subtitle="Xem nhanh tình hình bán hàng, tồn kho và các việc cần chú ý trong ngày."
      actions={
        <div className="flex items-center gap-2">
          {isPending && <span className="text-xs text-text-muted">Đang tải...</span>}
          <CustomDatePicker
            selected={parseDateOnly(date)}
            onChange={goToDate}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          />
        </div>
      }
    />
  );
}
