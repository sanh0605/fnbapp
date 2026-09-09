"use client";

import { useRouter } from "next/navigation";
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/DateRangeFilter";

// Client wiring for the server-rendered page.tsx: DateRangeFilter is a client
// component and needs somewhere to push the new range into the URL, which a
// server component cannot do itself.
export function FinanceFilterBar({ value, today }: { value: DateRangeValue; today: string }) {
  const router = useRouter();

  function handleChange(next: DateRangeValue) {
    const params = new URLSearchParams({ preset: next.preset });
    if (next.preset === "CUSTOM") {
      params.set("start", next.start);
      params.set("end", next.end);
    }
    router.push(`/admin/finance?${params.toString()}`);
  }

  return <DateRangeFilter value={value} onChange={handleChange} today={today} />;
}
