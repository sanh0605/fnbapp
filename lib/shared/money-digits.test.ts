import { describe, expect, it } from "vitest";
import { toMoneyDigits, groupThousands, caretAfterFormat } from "./money-digits";

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
