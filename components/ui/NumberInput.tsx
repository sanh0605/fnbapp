"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/shared/format";
import { groupNumberText, numberTextToValue } from "@/lib/shared/money-digits";
import { applyNumberEdit, numberToText } from "@/lib/shared/number-edit";

export interface NumberInputProps {
  id: string;
  decimals: number; // 0..6
  name?: string; // form mode: a hidden input posts the canonical text ("1250.5"; "5." posts "5")
  defaultValue?: number | string | null;
  value?: number | null; // page-held mode
  onValueChange?: (value: number | null) => void;
  unit?: string; // "ml", "g", "đ", "%": fixed at the right inside the box
  example?: string; // placeholder "Ví dụ: {example}"; default "1,250.5" when decimals > 0, else "12"
  hint?: string; // grey line under the box; any error message replaces it
  error?: string; // the page's own error; wins over the box's own message
  required?: boolean;
  min?: number;
  minExclusive?: boolean; // true: must be above min
  max?: number;
  maxMessage?: string;
  zeroIsEmpty?: boolean; // MoneyInput passes true
  disabled?: boolean;
  [ariaProp: `aria-${string}`]: string | undefined;
}

const COMMA_HINT_TEXT = "Số lẻ dùng dấu chấm, ví dụ 1.5";

function seedText(
  value: number | null | undefined,
  defaultValue: number | string | null | undefined,
  decimals: number,
  zeroIsEmpty?: boolean
): string {
  if (value !== undefined) {
    const t = numberToText(value, decimals);
    return zeroIsEmpty && t === "0" ? "" : t;
  }
  if (defaultValue !== undefined && defaultValue !== null) {
    if (typeof defaultValue === "number") {
      const t = numberToText(defaultValue, decimals);
      return zeroIsEmpty && t === "0" ? "" : t;
    }
    const raw = String(defaultValue);
    const res = applyNumberEdit({
      prevText: "",
      raw,
      caret: raw.length,
      decimals,
      zeroIsEmpty,
    });
    return res.accepted ? res.text : "";
  }
  return "";
}

function getValidationMessage(
  text: string,
  min?: number,
  minExclusive?: boolean,
  max?: number,
  maxMessage?: string
): string {
  if (text === "") return "";
  const val = numberTextToValue(text);
  if (val === null) return "";

  if (min !== undefined) {
    if (minExclusive) {
      if (val <= min) {
        return min === 0 ? "Nhập số lớn hơn 0." : `Nhập số lớn hơn ${formatNumber(min)}.`;
      }
    } else {
      if (val < min) {
        return `Nhập số từ ${formatNumber(min)} trở lên.`;
      }
    }
  }

  if (max !== undefined && val > max) {
    return maxMessage ?? `Nhập số không quá ${formatNumber(max)}.`;
  }

  return "";
}

export function NumberInput({
  id,
  decimals,
  name,
  defaultValue,
  value,
  onValueChange,
  unit,
  example,
  hint,
  error,
  required,
  min,
  minExclusive,
  max,
  maxMessage,
  zeroIsEmpty,
  disabled,
  ...ariaProps
}: NumberInputProps) {
  const [text, setText] = useState<string>(() =>
    seedText(value, defaultValue, decimals, zeroIsEmpty)
  );
  const [prevValue, setPrevValue] = useState<number | null | undefined>(value);
  const [boxError, setBoxError] = useState<string>("");
  const [commaHint, setCommaHint] = useState<boolean>(false);
  const [prevLimits, setPrevLimits] = useState({ min, minExclusive, max, maxMessage });

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  let currentText = text;
  // Page-held mode: sync when value changes externally
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
    if (numberTextToValue(text) !== value) {
      currentText = numberToText(value, decimals);
      setText(currentText);
      setBoxError("");
      setCommaHint(false);
    }
  }

  if (
    prevLimits.min !== min ||
    prevLimits.minExclusive !== minExclusive ||
    prevLimits.max !== max ||
    prevLimits.maxMessage !== maxMessage
  ) {
    setPrevLimits({ min, minExclusive, max, maxMessage });
    if (currentText !== "" && numberTextToValue(currentText) !== null) {
      const msg = getValidationMessage(currentText, min, minExclusive, max, maxMessage);
      setBoxError(msg);
    }
  }

  // Restore caret after text changes
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const el = inputRef.current;
    if (el) el.setSelectionRange(caret, caret);
  }, [text]);

  // Keep visible input validity in step for form submission checks
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const msg = getValidationMessage(text, min, minExclusive, max, maxMessage);
    el.setCustomValidity(msg);
  }, [text, min, minExclusive, max, maxMessage]);

  // Handle form reset
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleReset = () => {
      setText("");
      setBoxError("");
      setCommaHint(false);
      onValueChange?.(null);
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [onValueChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const inputType = (e.nativeEvent as InputEvent)?.inputType;

    const result = applyNumberEdit({
      prevText: text,
      raw,
      caret,
      inputType,
      decimals,
      zeroIsEmpty,
    });

    if (!result.accepted) {
      setCommaHint(false);
      e.target.value = result.display;
      e.target.setSelectionRange(result.caret, result.caret);
      return;
    }

    const val = numberTextToValue(result.text);
    if (max !== undefined && val !== null && val > max) {
      setBoxError(maxMessage ?? `Nhập số không quá ${formatNumber(max)}.`);
    } else {
      setBoxError("");
    }

    setCommaHint(result.commaHint);

    if (result.text !== text) {
      pendingCaretRef.current = result.caret;
      setText(result.text);
      onValueChange?.(val);
    } else {
      e.target.value = result.display;
      e.target.setSelectionRange(result.caret, result.caret);
    }
  };

  const handleBlur = () => {
    if (text !== "") {
      const msg = getValidationMessage(text, min, minExclusive, max, maxMessage);
      if (msg) {
        setBoxError(msg);
      }
    }
  };

  const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (required && text === "") {
      setBoxError("Cần nhập số.");
    } else {
      const msg = getValidationMessage(text, min, minExclusive, max, maxMessage);
      if (msg) {
        setBoxError(msg);
      }
    }
  };

  // Determine message and error status
  let errorMessage: string | undefined;
  let isError = false;

  if (error) {
    errorMessage = error;
    isError = true;
  } else if (boxError) {
    errorMessage = boxError;
    isError = true;
  } else if (commaHint) {
    errorMessage = COMMA_HINT_TEXT;
    isError = true;
  }

  const activeMessage = errorMessage ?? hint;
  const messageId = `${id}-message`;

  const defaultExample = decimals > 0 ? "1,250.5" : "12";
  const effectiveExample = example ?? defaultExample;
  const placeholder = `Ví dụ: ${effectiveExample}`;

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          value={groupNumberText(text)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onChange={handleChange}
          onBlur={handleBlur}
          onInvalid={handleInvalid}
          className={`w-full min-h-[48px] md:min-h-[40px] rounded-button bg-surface-card border px-3 text-base md:text-sm text-text-primary text-right tabular-nums outline-none focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50 ${
            isError
              ? "border-danger focus:border-danger"
              : "border-border focus:border-primary"
          }`}
          style={unit ? { paddingRight: `calc(${unit.length}ch + 1.25rem)` } : undefined}
          {...ariaProps}
          aria-invalid={isError ? "true" : (ariaProps["aria-invalid"] as "true" | "false" | undefined)}
          aria-describedby={activeMessage ? messageId : ariaProps["aria-describedby"]}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {activeMessage && (
        <div
          id={messageId}
          className={`text-xs mt-1 ${isError ? "text-danger" : "text-text-secondary"}`}
          role={isError ? "alert" : undefined}
        >
          {activeMessage}
        </div>
      )}
      {name && (
        <input
          type="hidden"
          name={name}
          value={text.endsWith(".") ? text.slice(0, -1) : text}
        />
      )}
    </div>
  );
}
