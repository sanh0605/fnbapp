"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { pickerDateToIsoDay, isoDayToPickerDate } from "@/components/ui/picker-date";

export function DailyDigestFilter({ date }: { date: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goToDate = (value: Date | null) => {
    if (!value) return;
    startTransition(() => {
      router.push(`?date=${pickerDateToIsoDay(value)}`);
    });
  };

  return (
    <PageHeader
      title="Tổng kết ngày"
      subtitle="Xem nhanh tình hình bán hàng, tồn kho và các việc cần chú ý trong ngày."
      actions={
        <div className="flex items-center gap-2">
          {isPending && <span className="text-xs text-text-muted">Đang tải...</span>}
          <CustomDatePicker
            selected={isoDayToPickerDate(date)}
            onChange={goToDate}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          />
        </div>
      }
    />
  );
}
