"use client";

import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

// Always shown, even with one year (owner note "title này đang là hardcode"):
// the year was never fixed, it just looked that way because the old buttons
// hid entirely when there was nothing to pick between.
export function YearSelect({ years, selected }: { years: number[]; selected: number }) {
  const router = useRouter();
  return (
    <Field label="Năm" htmlFor="pnl-year">
      <Select
        id="pnl-year"
        value={selected}
        onChange={e => router.push(`/admin/reports/pnl?year=${e.target.value}`)}
      >
        {years.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </Select>
    </Field>
  );
}
