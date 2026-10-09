"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangeButton } from "./DateRangeButton";
import { writeRangeParams, type RangeValue } from "@/lib/shared/date-range-params";

export function DateRangeUrlButton({
  value,
  today,
  mode,
}: {
  value: RangeValue;
  today: string;
  mode?: "day" | "month";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (next: RangeValue) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    writeRangeParams(params, next);
    params.delete("page");
    params.delete("year");
    router.push(pathname + "?" + params.toString());
  };

  return (
    <DateRangeButton
      value={value}
      today={today}
      mode={mode}
      onChange={handleChange}
    />
  );
}
