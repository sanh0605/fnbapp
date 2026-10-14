// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TextInput } from "./TextInput";

afterEach(cleanup);

// BR-UI-009 (owner 2026-10-08 "a"): an empty box shows only a worked example.
describe("TextInput example", () => {
  it("example=\"Trứng gà\" shows the grey text \"Ví dụ: Trứng gà\"", () => {
    render(<TextInput aria-label="Tìm kiếm" example="Trứng gà" />);
    expect(screen.getByLabelText("Tìm kiếm").getAttribute("placeholder")).toBe("Ví dụ: Trứng gà");
  });

  it("starts empty: the example is never the box's value", () => {
    render(<TextInput aria-label="Tìm kiếm" example="Trứng gà" />);
    expect((screen.getByLabelText("Tìm kiếm") as HTMLInputElement).value).toBe("");
  });
});

// Wave K5: a code made of digits (a bank account number) gets the phone's
// digit keypad but stays text — no commas, leading zeros kept.
describe("TextInput keypad (wave K5)", () => {
  it('keypad="digits" opens the digit keypad and keeps 0071001234567 as typed', () => {
    render(<TextInput aria-label="Số tài khoản" keypad="digits" defaultValue="0071001234567" />);
    const box = screen.getByLabelText("Số tài khoản") as HTMLInputElement;
    expect(box.type).toBe("text");
    expect(box.getAttribute("inputmode")).toBe("numeric");
    expect(box.value).toBe("0071001234567");
    expect(box.hasAttribute("keypad")).toBe(false);
  });
});
