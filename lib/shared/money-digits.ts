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

// Dot every 3 digits from the right. String work only (no Intl, no Number)
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
  return groups.join(".");
}

// Where to put the caret in `formatted` so it sits right after the same
// count of digits that were to its left before formatting -- inserting or
// removing a dot must not throw the caret to the end of the field.
export function caretAfterFormat(digitsLeftOfCaret: number, formatted: string): number {
  if (digitsLeftOfCaret <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9") {
      seen++;
      if (seen === digitsLeftOfCaret) return i + 1;
    }
  }
  return formatted.length;
}

export type DotDeleteDirection = "backward" | "forward";

export interface DotDeleteResult {
  digits: string;
  digitsLeftOfCaret: number;
}

// Backspace with the caret right after a dot, or Delete with it right
// before one, would otherwise delete only the dot -- the digits are
// unchanged and the key looks dead. The dot carries no value of its own, so
// remove the neighbouring digit instead: the one to the left for Backspace,
// the one to the right for Delete. `digitsLeftOfCaret` is counted the same
// way as everywhere else in this module (digits before the caret, ignoring
// dots); the returned `digitsLeftOfCaret` is where the caret should sit in
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
  // zeros -- e.g. "1.000.000" minus the leading "1" is "000000", not "0".
  // Strip it the same way toMoneyDigits does (fix round 2), and pull the
  // caret back by however many zeros were stripped, never past the start.
  const stripped = newDigits.replace(/^0+/, "");
  const zerosStripped = newDigits.length - stripped.length;
  return {
    digits: stripped,
    digitsLeftOfCaret: Math.max(0, newDigitsLeftOfCaret - zerosStripped),
  };
}
