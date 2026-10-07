import { describe, expect, it } from "vitest";
import { applyNumberEdit, numberToText } from "./number-edit";

const edit = (prevText: string, raw: string, caret = raw.length, extra: Partial<Parameters<typeof applyNumberEdit>[0]> = {}) =>
  applyNumberEdit({ prevText, raw, caret, decimals: 3, ...extra });

describe("applyNumberEdit (BR-UI-008, spec 2.2)", () => {
  it("groups 1250.5 typed in one go as 1,250.5", () => {
    expect(edit("", "1250.5")).toEqual({ accepted: true, text: "1250.5", display: "1,250.5", caret: 7, commaHint: false });
  });
  it("keeps the caret after a digit typed mid-number: 1,250.5 + 9 after the 2", () => {
    // browser shows "1,2950.5", caret after the 9 (index 4)
    expect(edit("1250.5", "1,2950.5", 4)).toMatchObject({ text: "12950.5", display: "12,950.5", caret: 4 });
  });
  it("refuses a 4th decimal and puts the caret back", () => {
    expect(edit("1.234", "1.2345", 6)).toEqual({ accepted: false, display: "1.234", caret: 5 });
  });
  it("refuses a 16th integer digit", () => {
    expect(edit("123456789012345", "1234567890123456", 16, { decimals: 0 }).accepted).toBe(false);
  });
  it("keeps 0.5 and turns .5 into 0.5", () => {
    expect(edit("", "0.5")).toMatchObject({ text: "0.5", display: "0.5" });
    expect(edit("", ".5")).toMatchObject({ text: "0.5", display: "0.5" });
  });
  it("drops letters and a second dot from a paste", () => {
    expect(edit("", "1,250.5abc")).toMatchObject({ text: "1250.5", display: "1,250.5" });
    expect(edit("1.5", "1.5.", 4)).toMatchObject({ text: "1.5", display: "1.5" });
  });
  it("drops a minus sign", () => {
    expect(edit("", "-5")).toMatchObject({ text: "5" });
  });
  it("drops the dot in a 0-decimal box", () => {
    expect(edit("150", "150.", 4, { decimals: 0 })).toMatchObject({ text: "150", display: "150", commaHint: false });
  });
  it("hints when a comma is typed in a decimal box and keeps the number", () => {
    expect(edit("1", "1,")).toMatchObject({ text: "1", display: "1", commaHint: true });
    expect(edit("1250", "1,250,")).toMatchObject({ text: "1250", display: "1,250", commaHint: true });
  });
  it("does not hint on the next keystroke without a comma", () => {
    expect(edit("1", "15")).toMatchObject({ text: "15", commaHint: false });
  });
  it("does not hint for a pasted, already grouped 1,250.5", () => {
    expect(edit("", "1,250.5")).toMatchObject({ text: "1250.5", commaHint: false });
  });
  it("does not hint while digits are typed into a grouped number", () => {
    expect(edit("1250", "1,2509")).toMatchObject({ text: "12509", display: "12,509", commaHint: false });
  });
  it("never hints in a 0-decimal box", () => {
    expect(edit("1", "1,", 2, { decimals: 0 })).toMatchObject({ commaHint: false });
  });
  it("Backspace right after a comma removes the digit before it, and 000.5 reads 0.5", () => {
    // "1,000.5", caret after the comma (2); the browser deletes the comma -> "1000.5", caret 1
    expect(edit("1000.5", "1000.5", 1, { inputType: "deleteContentBackward" })).toMatchObject({ text: "0.5", display: "0.5" });
  });
  it("Delete right before a comma removes the digit after it", () => {
    // "1,500,000", caret before the 2nd comma (5); Delete removes it -> "1,500000"
    expect(edit("1500000", "1,500000", 5, { decimals: 0, inputType: "deleteContentForward" })).toMatchObject({ text: "150000", display: "150,000" });
  });
  it("money: a lone 0, or zeros left after a Backspace, empty the box", () => {
    expect(edit("", "0", 1, { decimals: 0, zeroIsEmpty: true })).toMatchObject({ text: "", display: "" });
    expect(edit("1000000", "1000,000", 1, { decimals: 0, zeroIsEmpty: true, inputType: "deleteContentBackward" })).toMatchObject({ text: "" });
  });
  it("a decimal box keeps a lone 0 so 0.5 can be typed", () => {
    expect(edit("", "0")).toMatchObject({ text: "0", display: "0" });
  });
});

describe("numberToText", () => {
  it("writes a stored number as box text with a dot and no commas", () => {
    expect(numberToText(1250.5, 3)).toBe("1250.5");
    expect(numberToText(2.5, 3)).toBe("2.5");
    expect(numberToText(1.23456, 3)).toBe("1.235");
    expect(numberToText(150000, 0)).toBe("150000");
  });
  it("empty for nothing, NaN, Infinity or a negative", () => {
    for (const v of [null, undefined, NaN, Infinity, -1]) expect(numberToText(v as number, 3)).toBe("");
  });
});
