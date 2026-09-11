"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { caretAfterFormat, groupThousands, toMoneyDigits } from "@/lib/shared/money-digits";

interface MoneyInputProps {
  id: string;
  name: string;
  defaultValue?: number | string | null;
  required?: boolean;
  className?: string;
  placeholder?: string;
  // Pass-through for accessibility attributes only -- everything else about
  // this box is fixed (BR-CASH-005): digits only, grouped as you type.
  [ariaProp: `aria-${string}`]: string | undefined;
}

function countDigits(s: string): number {
  let n = 0;
  for (const ch of s) if (ch >= "0" && ch <= "9") n++;
  return n;
}

export function MoneyInput({
  id,
  name,
  defaultValue,
  required,
  className,
  placeholder,
  ...ariaProps
}: MoneyInputProps) {
  const [digits, setDigits] = useState(() => toMoneyDigits(String(defaultValue ?? "")));
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const formatted = groupThousands(digits);

  // Restore the caret after a re-render caused by a real digit change --
  // React would otherwise leave it at the end of the (now longer or
  // shorter) formatted string.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const el = inputRef.current;
    if (el) el.setSelectionRange(caret, caret);
  }, [digits]);

  // The cash-book form clears the amount box by unmounting the whole form
  // (FormModal returns null while closed), not by calling form.reset() --
  // but MoneyInput still needs to answer a real reset for any future caller
  // that does call it (and for this test).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleReset = () => setDigits("");
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const selStart = e.target.selectionStart ?? raw.length;
    const digitsLeftOfCaret = countDigits(raw.slice(0, selStart));
    const newDigits = toMoneyDigits(raw);
    const newFormatted = groupThousands(newDigits);

    if (newDigits === digits) {
      // Nothing actually changed (a non-digit char, or a digit past the
      // 15-digit cap) -- the browser may already have written the rejected
      // character into the DOM value before this handler ran, so put the
      // last valid display back rather than waiting on a state update that
      // React would otherwise skip (same value in, same value out).
      e.target.value = newFormatted;
      const caret = caretAfterFormat(digitsLeftOfCaret, newFormatted);
      e.target.setSelectionRange(caret, caret);
      return;
    }

    pendingCaretRef.current = caretAfterFormat(digitsLeftOfCaret, newFormatted);
    setDigits(newDigits);
  }

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        className={className}
        placeholder={placeholder}
        value={formatted}
        onChange={handleChange}
        {...ariaProps}
      />
      <input type="hidden" name={name} value={digits} />
    </>
  );
}
