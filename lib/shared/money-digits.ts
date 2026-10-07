/**
 * Pure string helpers for the digits-only money box (BR-CASH-005). Money
 * amounts in this app are whole đồng and can run to 15 digits, still under
 * Number.MAX_SAFE_INTEGER (16 digits) -- keeping every step here as string
 * work, never Number(), avoids float precision loss at that size.
 */

// Digits only, no leading zeros, NOT capped at 15 -- used by the caller to
// tell a keystroke that would push the box over the cap (which must be
// rejected outright, never truncated -- fix round 1, item 1) from one that
// fits.
export function toMoneyDigitsUncapped(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  return digitsOnly.replace(/^0+/, "");
}

// Digits only, no leading zeros, capped at 15 digits. "0" alone strips down
// to "" -- the box is empty, not showing a zero -- because the owner types
// an amount, he never means to enter zero đồng.
export function toMoneyDigits(raw: string): string {
  return toMoneyDigitsUncapped(raw).slice(0, 15);
}

// Comma every 3 digits from the right (BR-UI-008). String work only (no Intl, no Number)
// so it stays exact at any length, including past MAX_SAFE_INTEGER.
export function groupThousands(digits: string): string {
  if (!digits) return "";
  const groups: string[] = [];
  let end = digits.length;
  while (end > 3) {
    groups.unshift(digits.slice(end - 3, end));
    end -= 3;
  }
  groups.unshift(digits.slice(0, end));
  return groups.join(",");
}

// Where to put the caret in `formatted` so it sits right after the same
// count of digits and dots that were to its left before formatting --
// inserting or removing a comma must not throw the caret to the end of the
// field. Money text has no dot, so for money this counts digits only.
export function caretAfterFormat(charsLeftOfCaret: number, formatted: string): number {
  if (charsLeftOfCaret <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      seen++;
      if (seen === charsLeftOfCaret) return i + 1;
    }
  }
  return formatted.length;
}

export type DotDeleteDirection = "backward" | "forward";

export interface DotDeleteResult {
  digits: string;
  digitsLeftOfCaret: number;
}

// Backspace with the caret right after a thousands mark, or Delete with it
// right before one, would otherwise delete only the mark -- the digits are
// unchanged and the key looks dead. The mark carries no value of its own, so
// remove the neighbouring digit instead: the one to the left for Backspace,
// the one to the right for Delete. `digitsLeftOfCaret` is counted the same
// way as everywhere else in this module (digits before the caret, ignoring
// thousands marks); the returned `digitsLeftOfCaret` is where the caret should sit in
// the new digit string, ready for caretAfterFormat once it is reformatted.
export function removeDigitAcrossDot(
  digits: string,
  digitsLeftOfCaret: number,
  direction: DotDeleteDirection,
): DotDeleteResult {
  let newDigits: string;
  let newDigitsLeftOfCaret: number;

  if (direction === "backward") {
    if (digitsLeftOfCaret <= 0) return { digits, digitsLeftOfCaret };
    const removeIndex = digitsLeftOfCaret - 1;
    newDigits = digits.slice(0, removeIndex) + digits.slice(removeIndex + 1);
    newDigitsLeftOfCaret = removeIndex;
  } else {
    // forward: the digit immediately to the right of the caret sits at
    // index `digitsLeftOfCaret` in the digit string.
    if (digitsLeftOfCaret >= digits.length) return { digits, digitsLeftOfCaret };
    newDigits = digits.slice(0, digitsLeftOfCaret) + digits.slice(digitsLeftOfCaret + 1);
    newDigitsLeftOfCaret = digitsLeftOfCaret;
  }

  // Removing the digit next to the dot can leave a leading zero, or all
  // zeros -- e.g. "1,000,000" minus the leading "1" is "000000", not "0".
  // Strip it the same way toMoneyDigits does (fix round 2), and pull the
  // caret back by however many zeros were stripped, never past the start.
  const stripped = newDigits.replace(/^0+/, "");
  const zerosStripped = newDigits.length - stripped.length;
  return {
    digits: stripped,
    digitsLeftOfCaret: Math.max(0, newDigitsLeftOfCaret - zerosStripped),
  };
}

const MAX_INTEGER_DIGITS = 15;

// Typed or pasted text -> canonical number text: digits, at most one dot,
// no commas (BR-UI-008: the comma is the thousands mark and is never typed).
// null = reject the keystroke whole (too many decimals, or a 16th integer
// digit) -- never cut it down, which would silently keep another number.
export function normalizeNumberText(raw: string, decimals: number): string | null {
  const kept = raw.replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, "");
  const dot = kept.indexOf(".");
  const intRaw = dot < 0 ? kept : kept.slice(0, dot);
  const fraction = dot < 0 ? null : kept.slice(dot + 1).replace(/\./g, "");
  if (fraction !== null && fraction.length > decimals) return null;

  let intPart = intRaw.replace(/^0+(?=\d)/, "");
  if (intPart === "" && fraction !== null) intPart = "0";
  if (intPart.length > MAX_INTEGER_DIGITS) return null;
  return fraction === null ? intPart : `${intPart}.${fraction}`;
}

// Canonical text -> shown text: commas in the whole part, decimals as typed
// (a trailing dot stays while the user is still typing).
export function groupNumberText(text: string): string {
  if (!text) return "";
  const dot = text.indexOf(".");
  if (dot < 0) return groupThousands(text);
  return `${groupThousands(text.slice(0, dot))}.${text.slice(dot + 1)}`;
}

// Canonical text -> number; empty means nothing typed yet.
export function numberTextToValue(text: string): number | null {
  if (text === "") return null;
  const value = Number(text.endsWith(".") ? text.slice(0, -1) : text);
  return Number.isFinite(value) ? value : null;
}
