"use client";

import { useId, useState, useEffect, KeyboardEvent, forwardRef } from "react";
import { Calendar } from "lucide-react";
import { parseVnDay, formatVnDay } from "@/lib/shared/datetime";
import { CustomDatePicker } from "./CustomDatePicker";

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
    className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary focus:outline-none"
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
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function handleDateSelect(date: Date | null) {
    if (!date) {
      onChange("");
      setText("");
    } else {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${d}`;
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
          className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring pr-12"
        />
        <div className="absolute right-0 h-full flex items-center pr-2">
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
