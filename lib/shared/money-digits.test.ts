import { describe, expect, it } from "vitest";
import { toMoneyDigits, groupThousands, caretAfterFormat, removeDigitAcrossDot } from "./money-digits";

describe("BR-CASH-005 toMoneyDigits", () => {
  it("keeps only digits, dropping letters, dots, commas, dashes and spaces", () => {
    expect(toMoneyDigits("150.000đ")).toBe("150000");
    expect(toMoneyDigits("a")).toBe("");
    expect(toMoneyDigits(".")).toBe("");
    expect(toMoneyDigits(",")).toBe("");
    expect(toMoneyDigits("-")).toBe("");
    expect(toMoneyDigits(" ")).toBe("");
  });

  it("strips leading zeros", () => {
    expect(toMoneyDigits("0")).toBe("");
    expect(toMoneyDigits("00150")).toBe("150");
  });

  it("caps at 15 digits, staying under Number.MAX_SAFE_INTEGER", () => {
    const sixteenDigits = "1234567890123456";
    const result = toMoneyDigits(sixteenDigits);
    expect(result).toBe("123456789012345");
    expect(result.length).toBe(15);
    expect(Number.isSafeInteger(Number(result))).toBe(true);
  });

  it("reads an existing entry's amount the same way", () => {
    expect(toMoneyDigits("1728578")).toBe("1728578");
  });
});

describe("BR-CASH-005 groupThousands", () => {
  it("dots every 3 digits from the right, pure string work", () => {
    expect(groupThousands("1")).toBe("1");
    expect(groupThousands("1000")).toBe("1.000");
    expect(groupThousands("100000000000000")).toBe("100.000.000.000.000");
  });

  it("matches the typing sequence 1,5,0,0,0,0", () => {
    expect(groupThousands("1")).toBe("1");
    expect(groupThousands("15")).toBe("15");
    expect(groupThousands("150")).toBe("150");
    expect(groupThousands("1500")).toBe("1.500");
    expect(groupThousands("15000")).toBe("15.000");
    expect(groupThousands("150000")).toBe("150.000");
  });

  it("returns an empty string for an empty digit string", () => {
    expect(groupThousands("")).toBe("");
  });
});

describe("BR-CASH-005 caretAfterFormat", () => {
  it("places the caret right after the same count of digits in the formatted string", () => {
    // "1.950.000" with 2 digits to the left of the caret ("1", "9") -> caret
    // lands right after the "9", i.e. index 3.
    expect(caretAfterFormat(2, "1.950.000")).toBe(3);
  });

  it("clamps to the end when the count exceeds the digits available", () => {
    expect(caretAfterFormat(99, "150.000")).toBe("150.000".length);
  });

  it("returns 0 when no digits are left of the caret", () => {
    expect(caretAfterFormat(0, "150.000")).toBe(0);
  });
});

describe("BR-CASH-005 fix round 1 (item 3) removeDigitAcrossDot", () => {
  // "1.500.000" (digits "1500000"), caret right after the first dot
  // (position 2 -- 1 digit, "1", is left of it): Backspace would otherwise
  // delete only the dot. It must remove the "1" instead.
  it("Backspace over a dot removes the digit to its left", () => {
    const result = removeDigitAcrossDot("1500000", 1, "backward");
    expect(result.digits).toBe("500000");
    expect(result.digitsLeftOfCaret).toBe(0);
    expect(groupThousands(result.digits)).toBe("500.000");
    expect(caretAfterFormat(result.digitsLeftOfCaret, groupThousands(result.digits))).toBe(0);
  });

  // Same box, caret right before the second dot (position 5 -- 4 digits,
  // "1500", are left of it): Delete would otherwise delete only the dot. It
  // must remove the digit to its right (the first "0" of the last group)
  // instead.
  it("Delete over a dot removes the digit to its right", () => {
    const result = removeDigitAcrossDot("1500000", 4, "forward");
    expect(result.digits).toBe("150000");
    expect(result.digitsLeftOfCaret).toBe(4);
    expect(groupThousands(result.digits)).toBe("150.000");
    // Reported to the coordinator: the digit removed was to the right of
    // the caret, so the digit count left of the caret is unchanged (still
    // 4) -- caretAfterFormat then lands at 5, not 3. Regrouping the
    // shortened digit string moves the second dot, so "4 digits in" no
    // longer sits right at a dot boundary the way it used to.
    expect(caretAfterFormat(result.digitsLeftOfCaret, groupThousands(result.digits))).toBe(5);
  });

  it("does nothing at the start (Backspace) or end (Delete) of the digits", () => {
    expect(removeDigitAcrossDot("150", 0, "backward")).toEqual({ digits: "150", digitsLeftOfCaret: 0 });
    expect(removeDigitAcrossDot("150", 3, "forward")).toEqual({ digits: "150", digitsLeftOfCaret: 3 });
  });
});

describe("BR-CASH-005 fix round 2: removeDigitAcrossDot strips leading zeros", () => {
  // "1.000.000" (digits "1000000"), caret right after the first dot
  // (1 digit, "1", left of it): Backspace removes the "1", leaving
  // "000000" -- which must normalise down to "", not display as "000.000".
  it("removing the leading digit down to all zeros empties the box", () => {
    const result = removeDigitAcrossDot("1000000", 1, "backward");
    expect(result.digits).toBe("");
    expect(result.digitsLeftOfCaret).toBe(0);
    expect(groupThousands(result.digits)).toBe("");
  });

  // "1.050.000" (digits "1050000"), same caret: Backspace removes the "1",
  // leaving "050000" -- one leading zero must be stripped down to "50000".
  it("removing the leading digit down to one leading zero strips it", () => {
    const result = removeDigitAcrossDot("1050000", 1, "backward");
    expect(result.digits).toBe("50000");
    expect(result.digitsLeftOfCaret).toBe(0);
    expect(groupThousands(result.digits)).toBe("50.000");
  });
});
