"use client";
// A date-time box whose value is a Saigon wall-clock string "YYYY-MM-DDTHH:mm" (or "").
// The picker works with device-local Date objects, so the wall-clock digits are copied
// into a device-local Date and back again -- the digits shown are always the Saigon
// digits in the string, whatever time zone the device is set to.

import { CustomDatePicker } from "./CustomDatePicker";

export function wallToPickerDate(wall: string): Date | null {
  if (!wall || typeof wall !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const h = Number(match[4]);
  const min = Number(match[5]);
  const date = new Date(y, m - 1, d, h, min, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function pickerDateToWall(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export interface SaigonDateTimeInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  className?: string;
}

export function SaigonDateTimeInput({
  id,
  value,
  onChange,
  clearable,
  className = "w-full min-h-[48px] md:min-h-[40px] rounded-button bg-surface-card border border-border px-3 pr-12 md:pr-10 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50",
}: SaigonDateTimeInputProps) {
  return (
    <CustomDatePicker
      id={id}
      selected={wallToPickerDate(value)}
      onChange={(d: Date | null) => onChange(pickerDateToWall(d))}
      showTimeSelect
      timeIntervals={5}
      dateFormat="dd/MM/yyyy HH:mm"
      isClearable={clearable ?? false}
      placeholderText="dd/mm/yyyy hh:mm"
      className={className}
    />
  );
}
