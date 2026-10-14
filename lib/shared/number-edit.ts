/**
 * Keystroke rule shared by every number box (BR-UI-008, BR-CASH-005): keep
 * digits and one dot, insert commas for display, keep the caret where the
 * user expects it, refuse a keystroke that would break the limits. Pure
 * string work on top of the helpers in money-digits.ts -- no React, no
 * locale formatting.
 */
import {
  caretAfterFormat,
  groupNumberText,
  normalizeNumberText,
  removeDigitAcrossDot,
} from "./money-digits";

export interface NumberEditInput {
  prevText: string; // canonical text before the keystroke, e.g. "1250.5" ("" = empty)
  raw: string; // the box's value after the browser applied the keystroke
  caret: number; // selectionStart in `raw`
  inputType?: string | null; // InputEvent.inputType when the browser gives one
  decimals: number; // 0..6
  zeroIsEmpty?: boolean; // money: a lone 0 empties the box (BR-CASH-005)
}

export type NumberEditResult =
  | { accepted: true; text: string; display: string; caret: number; commaHint: boolean }
  | { accepted: false; display: string; caret: number };

function keepChars(s: string, decimals: number): string {
  return s.replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, "");
}

function countCommas(s: string): number {
  let n = 0;
  for (const ch of s) if (ch === ",") n++;
  return n;
}

export function applyNumberEdit(input: NumberEditInput): NumberEditResult {
  const { prevText, inputType, decimals, zeroIsEmpty } = input;
  let { raw, caret } = input;
  // A dot typed while the box already holds one: the dot already there stays,
  // the one just typed (the char left of the caret) is dropped.
  if (
    decimals > 0 &&
    prevText.includes(".") &&
    raw[caret - 1] === "." &&
    keepChars(raw, decimals).split(".").length > 2
  ) {
    raw = raw.slice(0, caret - 1) + raw.slice(caret);
    caret -= 1;
  }
  const prevDisplay = groupNumberText(prevText);
  let keptLeft = keepChars(raw.slice(0, caret), decimals).length;

  const normalized = normalizeNumberText(raw, decimals);
  if (normalized === null) {
    // Reject whole, caret back to where it was before the keystroke: the
    // keystroke added however many more kept chars than the old display held.
    const added = keepChars(raw, decimals).length - keepChars(prevDisplay, decimals).length;
    const caretBefore = Math.max(0, keptLeft - added);
    return { accepted: false, display: prevDisplay, caret: caretAfterFormat(caretBefore, prevDisplay) };
  }

  // Normalisation puts a 0 in front of a lone leading dot; when the caret is
  // after that dot the 0 is a character left of the caret too.
  if (keepChars(raw, decimals).startsWith(".") && keptLeft >= 1) keptLeft += 1;

  const clean = (t: string): string => (zeroIsEmpty && t === "0" ? "" : t);
  const next = clean(normalized);

  const finish = (text: string, caretChars: number): NumberEditResult => {
    const display = groupNumberText(text);
    const commaHint =
      decimals > 0 && countCommas(raw) > countCommas(prevDisplay) && raw !== display;
    return {
      accepted: true,
      text,
      display,
      caret: caretAfterFormat(caretChars, display),
      commaHint,
    };
  };

  if (next !== prevText) return finish(next, keptLeft);

  // Nothing changed by plain extraction. A Backspace or Delete that landed on
  // a comma removes the neighbouring digit instead, so the key is not dead.
  const direction =
    inputType === "deleteContentBackward" ? "backward" :
    inputType === "deleteContentForward" ? "forward" :
    null;
  if (direction) {
    const removed = removeDigitAcrossDot(prevText, keptLeft, direction);
    if (removed.digits !== prevText) {
      const renormalized = normalizeNumberText(removed.digits, decimals);
      if (renormalized !== null) {
        const after = clean(renormalized);
        if (after !== prevText) return finish(after, removed.digitsLeftOfCaret);
      }
    }
  }

  // A dropped character (letter, second dot, minus, comma): keep the number.
  return finish(prevText, keptLeft);
}

// Stored number -> canonical box text: at most `decimals` places, a dot, no
// commas, no exponent. Nothing, non-finite and negative all read as empty.
export function numberToText(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return "";
  const factor = 10 ** decimals;
  const text = String(Math.round(value * factor) / factor);
  return text.includes("e") ? "" : text;
}
