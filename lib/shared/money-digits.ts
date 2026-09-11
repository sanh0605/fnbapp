/**
 * Pure string helpers for the digits-only money box (BR-CASH-005). Money
 * amounts in this app are whole đồng and can run to 15 digits, still under
 * Number.MAX_SAFE_INTEGER (16 digits) -- keeping every step here as string
 * work, never Number(), avoids float precision loss at that size.
 */

// Digits only, no leading zeros, capped at 15 digits. "0" alone strips down
// to "" -- the box is empty, not showing a zero -- because the owner types
// an amount, he never means to enter zero đồng.
export function toMoneyDigits(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  const noLeadingZeros = digitsOnly.replace(/^0+/, "");
  return noLeadingZeros.slice(0, 15);
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
