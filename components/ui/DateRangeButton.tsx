"use client";

import { useState, useRef, useEffect, useId } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { vi } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronDown } from "lucide-react";
import { Button } from "./Button";
import { DayInput } from "./DayInput";
import {
  DATE_RANGE_PRESETS,
  MONTH_PRESET_KEYS,
  PHONE_PRESET_KEYS,
  presetLabel,
  resolvePreset,
  type DateRangePresetKey,
} from "@/lib/shared/date-range-presets";
import {
  formatRangeButtonText,
  readMonthRangeParams,
  type RangeValue,
} from "@/lib/shared/date-range-params";
import { isoDayToPickerDate, pickerDateToIsoDay } from "./picker-date";

registerLocale("vi", vi);

function isoMonthToVn(isoMonth: string): string {
  if (!isoMonth || isoMonth === "invalid") return "";
  const [y, m] = isoMonth.split("-");
  return m && y ? `${m}/${y}` : "";
}

function parseVnMonth(text: string): { valid: boolean; iso: string } {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true, iso: "" };
  const m = /^(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!m) return { valid: false, iso: "invalid" };
  const monthNum = Number(m[1]);
  const yearNum = Number(m[2]);
  if (monthNum < 1 || monthNum > 12 || yearNum < 1000 || yearNum > 9999) {
    return { valid: false, iso: "invalid" };
  }
  return {
    valid: true,
    iso: `${yearNum}-${String(monthNum).padStart(2, "0")}`,
  };
}

function isoMonthToPickerDate(isoMonth: string): Date | null {
  if (!isoMonth || isoMonth === "invalid") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(isoMonth);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return new Date(y, mo - 1, 1);
}

function pickerDateToIsoMonth(d: Date): string {
  return pickerDateToIsoDay(d).slice(0, 7);
}

function MonthInput({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
}) {
  const [text, setText] = useState(() => (value === "invalid" ? "invalid" : isoMonthToVn(value)));

  useEffect(() => {
    if (value === "invalid") return;
    setText(isoMonthToVn(value));
  }, [value]);

  function handleCommit() {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange("");
      setText("");
      return;
    }
    const parsed = parseVnMonth(trimmed);
    if (parsed.valid && parsed.iso) {
      onChange(parsed.iso);
      setText(isoMonthToVn(parsed.iso));
    } else {
      onChange("invalid");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="Ví dụ: 07/2026"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCommit();
          }
        }}
        className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function DateRangeButton(props: {
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  today: string; // yyyy-mm-dd, Saigon
  mode?: "day" | "month"; // default "day"
  disabled?: boolean;
  disabledHint?: string; // shown under the button when disabled
  align?: "left" | "right";
}) {
  const { value, onChange, today, mode = "day", disabled = false, disabledHint, align = "left" } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<DateRangePresetKey>(value.preset);
  const [draftStart, setDraftStart] = useState<string>(value.start);
  const [draftEnd, setDraftEnd] = useState<string>(value.end);
  const [phoneCustom, setPhoneCustom] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const desktopRightSideRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();

  useEffect(() => {
    setDraftPreset(value.preset);
    setDraftStart(value.start);
    setDraftEnd(value.end);
  }, [value.preset, value.start, value.end]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setDraftPreset(value.preset);
        setDraftStart(value.start);
        setDraftEnd(value.end);
        setPhoneCustom(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setDraftPreset(value.preset);
        setDraftStart(value.start);
        setDraftEnd(value.end);
        setPhoneCustom(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, value.preset, value.start, value.end]);

  const handleTriggerClick = () => {
    if (disabled) return;
    if (!isOpen) {
      setDraftPreset(value.preset);
      setDraftStart(value.start);
      setDraftEnd(value.end);
      setPhoneCustom(false);
      setIsOpen(true);
      triggerRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    } else {
      setIsOpen(false);
    }
  };

  const handlePresetClick = (key: DateRangePresetKey) => {
    if (key === "CUSTOM") {
      setDraftPreset("CUSTOM");
      desktopRightSideRef.current?.querySelector("input")?.focus();
      return;
    }
    if (mode === "month") {
      const next = readMonthRangeParams({ range: key }, today);
      onChange(next);
      setIsOpen(false);
    } else {
      const r = resolvePreset(key, today);
      onChange({ preset: key, start: r.start, end: r.end });
      setIsOpen(false);
    }
  };

  const handlePhonePresetClick = (key: DateRangePresetKey) => {
    if (key === "CUSTOM") {
      setPhoneCustom(true);
      setDraftPreset("CUSTOM");
      return;
    }
    if (mode === "month") {
      const next = readMonthRangeParams({ range: key }, today);
      onChange(next);
      setIsOpen(false);
    } else {
      const r = resolvePreset(key, today);
      onChange({ preset: key, start: r.start, end: r.end });
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setDraftPreset(value.preset);
    setDraftStart(value.start);
    setDraftEnd(value.end);
    setPhoneCustom(false);
  };

  const handleApply = () => {
    if (isApplyDisabled) return;
    onChange({ preset: "CUSTOM", start: draftStart, end: draftEnd });
    setIsOpen(false);
  };

  const handleCalendarChange = (dates: [Date | null, Date | null] | null) => {
    if (!dates) return;
    const [start, end] = dates;
    if (mode === "month") {
      if (start) {
        setDraftStart(pickerDateToIsoMonth(start));
      }
      if (end) {
        setDraftEnd(pickerDateToIsoMonth(end));
      } else {
        setDraftEnd("");
      }
    } else {
      if (start) {
        setDraftStart(pickerDateToIsoDay(start));
      }
      if (end) {
        setDraftEnd(pickerDateToIsoDay(end));
      } else {
        setDraftEnd("");
      }
    }
    setDraftPreset("CUSTOM");
  };

  const isStartInvalid = draftStart === "invalid";
  const isEndInvalid = draftEnd === "invalid";
  const hasInvalid = isStartInvalid || isEndInvalid;
  const isEmpty = !draftStart || !draftEnd;
  const isOrderInvalid = !hasInvalid && !isEmpty && draftStart > draftEnd;
  const isApplyDisabled = isEmpty || hasInvalid || isOrderInvalid;

  const startDateObj = draftStart && draftStart !== "invalid" ? isoDayToPickerDate(draftStart) : null;
  const endDateObj = draftEnd && draftEnd !== "invalid" ? isoDayToPickerDate(draftEnd) : null;
  const startMonthDateObj = draftStart && draftStart !== "invalid" ? isoMonthToPickerDate(draftStart) : null;
  const endMonthDateObj = draftEnd && draftEnd !== "invalid" ? isoMonthToPickerDate(draftEnd) : null;

  const buttonText = formatRangeButtonText(value, mode);
  const parts = buttonText.split(" · ");
  const presetName = parts[0];
  const datesLabel = parts.slice(1).join(" · ");

  const desktopKeys: readonly DateRangePresetKey[] =
    mode === "month" ? MONTH_PRESET_KEYS : DATE_RANGE_PRESETS.map((p) => p.key);

  const phoneKeys: readonly DateRangePresetKey[] =
    mode === "month" ? MONTH_PRESET_KEYS : PHONE_PRESET_KEYS;

  return (
    <div ref={containerRef} className="relative w-full md:w-auto inline-block">
      <button
        ref={triggerRef}
        type="button"
        data-testid="range-button"
        disabled={disabled}
        onClick={handleTriggerClick}
        className="w-full md:w-auto min-h-[48px] md:min-h-[40px] px-3.5 py-2 rounded-xl border border-border bg-surface-card hover:bg-page transition-colors text-left flex items-center justify-between gap-3 shadow-sm disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
      >
        <div className="flex flex-col md:flex-row md:items-center">
          <span className="font-semibold text-text-primary text-sm">{presetName}</span>
          {datesLabel ? (
            <span className="text-text-muted text-xs md:text-sm font-normal">
              <span className="hidden md:inline"> · </span>
              {datesLabel}
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {disabled && disabledHint ? (
        <p className="text-xs text-text-muted mt-1">{disabledHint}</p>
      ) : null}

      {isOpen && (
        <>
          {/* Computer panel */}
          <div
            data-testid="range-panel-desktop"
            className={`hidden md:block absolute ${
              align === "right" ? "right-0" : "left-0"
            } top-full z-20 mt-2 bg-surface-card border border-border rounded-2xl shadow-xl p-4 w-max`}
          >
            <div className="flex divide-x divide-border">
              {/* Presets list */}
              <div className="w-52 pr-4 flex flex-col gap-1 max-h-[460px] overflow-y-auto shrink-0">
                {desktopKeys.map((key) => {
                  const isPressed = draftPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isPressed ? "true" : "false"}
                      onClick={() => handlePresetClick(key)}
                      className={`w-full text-left px-3 py-2 min-h-[48px] md:min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
                        isPressed
                          ? "bg-primary-soft text-primary font-semibold"
                          : "text-text-primary hover:bg-page"
                      }`}
                    >
                      {presetLabel(key)}
                    </button>
                  );
                })}
              </div>

              {/* Right side */}
              <div ref={desktopRightSideRef} className="pl-4 flex flex-col justify-between shrink-0">
                <div>
                  {mode === "month" ? (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <MonthInput
                        id={`desktop-from-month-${uniqueId}`}
                        label="Từ tháng"
                        value={draftStart}
                        onChange={(val) => {
                          setDraftStart(val);
                          setDraftPreset("CUSTOM");
                        }}
                        error={isStartInvalid ? "Tháng không hợp lệ" : undefined}
                      />
                      <MonthInput
                        id={`desktop-to-month-${uniqueId}`}
                        label="Đến tháng"
                        value={draftEnd}
                        onChange={(val) => {
                          setDraftEnd(val);
                          setDraftPreset("CUSTOM");
                        }}
                        error={isEndInvalid ? "Tháng không hợp lệ" : undefined}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <DayInput
                        label="Từ ngày"
                        value={draftStart}
                        onChange={(val) => {
                          setDraftStart(val);
                          setDraftPreset("CUSTOM");
                        }}
                        error={isStartInvalid ? "Ngày không hợp lệ" : undefined}
                      />
                      <DayInput
                        label="Đến ngày"
                        value={draftEnd}
                        onChange={(val) => {
                          setDraftEnd(val);
                          setDraftPreset("CUSTOM");
                        }}
                        error={isEndInvalid ? "Ngày không hợp lệ" : undefined}
                      />
                    </div>
                  )}

                  {isOrderInvalid && (
                    <p className="text-sm text-danger mb-2">
                      {mode === "month"
                        ? "Tháng đầu phải trước tháng cuối"
                        : "Ngày đầu phải trước ngày cuối"}
                    </p>
                  )}

                  <div className="flex justify-center my-2">
                    {mode === "month" ? (
                      <DatePicker
                        inline
                        selectsRange
                        showMonthYearPicker
                        calendarStartDay={1}
                        locale="vi"
                        calendarClassName="range-calendar"
                        startDate={startMonthDateObj}
                        endDate={endMonthDateObj}
                        onChange={handleCalendarChange as any}
                      />
                    ) : (
                      <DatePicker
                        inline
                        selectsRange
                        monthsShown={2}
                        calendarStartDay={1}
                        locale="vi"
                        calendarClassName="range-calendar"
                        startDate={startDateObj}
                        endDate={endDateObj}
                        onChange={handleCalendarChange as any}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    Huỷ
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isApplyDisabled}
                    onClick={handleApply}
                  >
                    Áp dụng
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Phone panel */}
          <div
            data-testid="range-panel-phone"
            className="md:hidden mt-2 bg-surface-card border border-border rounded-2xl shadow-sm p-3 w-full"
          >
            {!phoneCustom ? (
              <div className="grid grid-cols-3 gap-2">
                {phoneKeys.map((key) => {
                  const isPressed = draftPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isPressed ? "true" : "false"}
                      onClick={() => handlePhonePresetClick(key)}
                      className={`px-2 py-2 min-h-[48px] md:min-h-[40px] rounded-lg text-xs sm:text-sm font-medium border text-center transition-colors flex items-center justify-center ${
                        isPressed
                          ? "bg-primary-soft text-primary border-primary font-semibold"
                          : "bg-surface-card text-text-primary border-border hover:bg-page"
                      }`}
                    >
                      {presetLabel(key)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {mode === "month" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <MonthInput
                      id={`phone-from-month-${uniqueId}`}
                      label="Từ tháng"
                      value={draftStart}
                      onChange={(val) => {
                        setDraftStart(val);
                        setDraftPreset("CUSTOM");
                      }}
                      error={isStartInvalid ? "Tháng không hợp lệ" : undefined}
                    />
                    <MonthInput
                      id={`phone-to-month-${uniqueId}`}
                      label="Đến tháng"
                      value={draftEnd}
                      onChange={(val) => {
                        setDraftEnd(val);
                        setDraftPreset("CUSTOM");
                      }}
                      error={isEndInvalid ? "Tháng không hợp lệ" : undefined}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <DayInput
                      label="Từ ngày"
                      value={draftStart}
                      onChange={(val) => {
                        setDraftStart(val);
                        setDraftPreset("CUSTOM");
                      }}
                      error={isStartInvalid ? "Ngày không hợp lệ" : undefined}
                    />
                    <DayInput
                      label="Đến ngày"
                      value={draftEnd}
                      onChange={(val) => {
                        setDraftEnd(val);
                        setDraftPreset("CUSTOM");
                      }}
                      error={isEndInvalid ? "Ngày không hợp lệ" : undefined}
                    />
                  </div>
                )}

                {isOrderInvalid && (
                  <p className="text-sm text-danger">
                    {mode === "month"
                      ? "Tháng đầu phải trước tháng cuối"
                      : "Ngày đầu phải trước ngày cuối"}
                  </p>
                )}

                <div className="flex justify-center my-1 overflow-x-auto">
                  {mode === "month" ? (
                    <DatePicker
                      inline
                      selectsRange
                      showMonthYearPicker
                      calendarStartDay={1}
                      locale="vi"
                      startDate={startMonthDateObj}
                      endDate={endMonthDateObj}
                      onChange={handleCalendarChange as any}
                    />
                  ) : (
                    <DatePicker
                      inline
                      selectsRange
                      monthsShown={1}
                      calendarStartDay={1}
                      locale="vi"
                      startDate={startDateObj}
                      endDate={endDateObj}
                      onChange={handleCalendarChange as any}
                    />
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    Huỷ
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isApplyDisabled}
                    onClick={handleApply}
                  >
                    Áp dụng
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
