"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  caretAfterFormat,
  groupThousands,
  removeDigitAcrossDot,
  toMoneyDigits,
  toMoneyDigitsUncapped,
} from "@/lib/shared/money-digits";

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

    // Fix round 1, item 1: a keystroke (or a paste) that would push the box
    // over the 15-digit cap is rejected whole, never truncated from the
    // tail -- slicing would silently keep a different number. Reject by
    // restoring the digits exactly as they were, with the caret back where
    // it was before this keystroke: the keystroke inserted however many
    // more digits `uncapped` now holds than the box held before.
    const uncapped = toMoneyDigitsUncapped(raw);
    if (uncapped.length > 15) {
      const oldFormatted = groupThousands(digits);
      const insertedDigits = uncapped.length - digits.length;
      const caretBefore = Math.max(0, digitsLeftOfCaret - insertedDigits);
      e.target.value = oldFormatted;
      const caret = caretAfterFormat(caretBefore, oldFormatted);
      e.target.setSelectionRange(caret, caret);
      return;
    }

    const newDigits = toMoneyDigits(raw);

    if (newDigits !== digits) {
      const newFormatted = groupThousands(newDigits);
      pendingCaretRef.current = caretAfterFormat(digitsLeftOfCaret, newFormatted);
      setDigits(newDigits);
      return;
    }

    // Nothing changed by plain digit extraction. Two possible causes:
    // - Fix round 1, item 3: Backspace/Delete landed on a dot, which
    //   carries no digit of its own, so it looks like the key did nothing.
    //   Remove the neighbouring digit instead.
    // - A non-digit character was typed or pasted (dropped, as always).
    const inputType = (e.nativeEvent as InputEvent).inputType;
    const direction =
      inputType === "deleteContentBackward" ? "backward" :
      inputType === "deleteContentForward" ? "forward" :
      null;

    if (direction) {
      const result = removeDigitAcrossDot(digits, digitsLeftOfCaret, direction);
      if (result.digits !== digits) {
        const resultFormatted = groupThousands(result.digits);
        pendingCaretRef.current = caretAfterFormat(result.digitsLeftOfCaret, resultFormatted);
        setDigits(result.digits);
        return;
      }
    }

    // A rejected non-digit character, or (an old browser with no
    // inputType) a delete over a dot kept as today's no-op behaviour -- the
    // browser may already have written it into the DOM value before this
    // handler ran, so put the last valid display back rather than waiting
    // on a state update that React would otherwise skip (same value in,
    // same value out).
    const formatted = groupThousands(digits);
    e.target.value = formatted;
    const caret = caretAfterFormat(digitsLeftOfCaret, formatted);
    e.target.setSelectionRange(caret, caret);
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
