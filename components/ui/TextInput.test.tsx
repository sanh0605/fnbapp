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
