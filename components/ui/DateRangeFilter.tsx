"use client";

import { useEffect, useState } from "react";
import {
  DATE_RANGE_PRESETS,
  formatRangeLabel,
  resolvePreset,
  type DateRangePresetKey,
} from "@/lib/shared/date-range-presets";
import { CustomDatePicker } from "./CustomDatePicker";

export interface DateRangeValue {
  preset: DateRangePresetKey;
  start: string;
  end: string;
}

// "YYYY-MM-DD" <-> Date using local calendar fields only (no time-zone
// conversion) -- CustomDatePicker/react-datepicker works with a plain
// calendar day, and start/end never carry a time component.
function isoToLocalDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const CUSTOM_RANGE_ORDER_ERROR = "Ngày đầu phải trước ngày cuối";

export function DateRangeFilter(props: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  today: string; // "YYYY-MM-DD" in Asia/Saigon, passed in by the page
}): JSX.Element {
  const { value, onChange, today } = props;
  const [uiPreset, setUiPreset] = useState<DateRangePresetKey>(value.preset);
  const [customStart, setCustomStart] = useState<Date | null>(
    value.preset === "CUSTOM" ? isoToLocalDate(value.start) : null,
  );
  const [customEnd, setCustomEnd] = useState<Date | null>(
    value.preset === "CUSTOM" ? isoToLocalDate(value.end) : null,
  );
  const [error, setError] = useState<string | null>(null);

  // Stay in sync when the page changes `value` from outside (e.g. reading
  // the range back from the URL).
  useEffect(() => {
    setUiPreset(value.preset);
    if (value.preset === "CUSTOM") {
      setCustomStart(isoToLocalDate(value.start));
      setCustomEnd(isoToLocalDate(value.end));
    }
  }, [value.preset, value.start, value.end]);

  function handlePresetChange(key: DateRangePresetKey) {
    setUiPreset(key);
    if (key === "CUSTOM") {
      // Just switch the inputs on; wait for both dates before reporting a
      // range upward.
      setError(null);
      return;
    }
    setError(null);
    const range = resolvePreset(key, today);
    onChange({ preset: key, start: range.start, end: range.end });
  }

  function handleCustomDateChange(which: "start" | "end", date: Date | null) {
    const nextStart = which === "start" ? date : customStart;
    const nextEnd = which === "end" ? date : customEnd;
    setCustomStart(nextStart);
    setCustomEnd(nextEnd);

    if (!nextStart || !nextEnd) {
      setError(null);
      return;
    }
    const startIso = localDateToIso(nextStart);
    const endIso = localDateToIso(nextEnd);
    if (startIso > endIso) {
      setError(CUSTOM_RANGE_ORDER_ERROR);
      return;
    }
    setError(null);
    onChange({ preset: "CUSTOM", start: startIso, end: endIso });
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:flex-1">
        <select
          value={uiPreset}
          onChange={(e) => handlePresetChange(e.target.value as DateRangePresetKey)}
          className="w-full md:w-56 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
        >
          {DATE_RANGE_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>

        {uiPreset === "CUSTOM" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <CustomDatePicker
              selected={customStart}
              onChange={(date) => handleCustomDateChange("start", date)}
              placeholderText="Từ ngày"
              dateFormat="dd/MM/yyyy"
              showTimeSelect={false}
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
            />
            <CustomDatePicker
              selected={customEnd}
              onChange={(date) => handleCustomDateChange("end", date)}
              placeholderText="Đến ngày"
              dateFormat="dd/MM/yyyy"
              showTimeSelect={false}
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
            />
          </div>
        )}
      </div>

      {error ? (
        <span className="text-sm text-danger">{error}</span>
      ) : (
        <span className="text-sm text-text-muted">{formatRangeLabel(value.start, value.end)}</span>
      )}
    </div>
  );
}
