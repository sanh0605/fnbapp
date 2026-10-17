"use client";

import { useId, useState, useEffect, KeyboardEvent, forwardRef } from "react";
import { Calendar } from "lucide-react";
import { parseVnDay, formatVnDay } from "@/lib/shared/datetime";
import { CustomDatePicker } from "./CustomDatePicker";
import { pickerDateToIsoDay, isoDayToPickerDate } from "./picker-date";

export interface DayInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const CalendarButton = forwardRef<HTMLButtonElement, any>(({ onClick }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="min-h-[48px] md:min-h-[40px] min-w-[48px] md:min-w-[40px] flex items-center justify-center text-text-muted hover:text-text-primary focus:outline-none"
    tabIndex={-1}
    aria-label="Chọn ngày"
  >
    <Calendar className="w-5 h-5" />
  </button>
));
CalendarButton.displayName = "CalendarButton";

export function DayInput({ label, value, onChange, error }: DayInputProps) {
  const id = useId();
  const inputId = `day-input-${id}`;
  
  const [text, setText] = useState(() => (value === "invalid" ? "invalid" : formatVnDay(value)));

  useEffect(() => {
    if (value === "invalid") return;
    const formatted = formatVnDay(value);
    setText(formatted);
  }, [value]);

  function handleBlurOrEnter() {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange("");
      setText("");
    } else {
      const parsed = parseVnDay(trimmed);
      if (parsed) {
        onChange(parsed);
        setText(formatVnDay(parsed));
      } else {
        onChange("invalid");
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlurOrEnter();
    }
  }

  function parseIsoToLocal(isoDay: string): Date | null {
    if (!isoDay || isoDay === "invalid") return null;
    return isoDayToPickerDate(isoDay);
  }

  function handleDateSelect(date: Date | null) {
    if (!date) {
      onChange("");
      setText("");
    } else {
      const iso = pickerDateToIsoDay(date);
      onChange(iso);
      setText(formatVnDay(iso));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlurOrEnter}
          onKeyDown={handleKeyDown}
          className={`w-full min-h-[48px] md:min-h-[40px] rounded-button bg-surface-card border ${
            error ? "border-danger" : "border-border"
          } px-3 pr-12 md:pr-10 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50`}
        />
        <div className="absolute right-0 h-full flex items-center">
          <CustomDatePicker
            selected={parseIsoToLocal(value)}
            onChange={handleDateSelect}
            showTimeSelect={false}
            dateFormat="dd/MM/yyyy"
            customInput={<CalendarButton />}
            isClearable={false}
          />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
