// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./MoneyInput";

afterEach(cleanup);

function getVisible(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

function getHidden(name: string): HTMLInputElement {
  return document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement;
}

describe("BR-CASH-005 MoneyInput", () => {
  it("has no name on the visible input and inputMode=numeric", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    expect(visible.getAttribute("name")).toBeNull();
    expect(visible.getAttribute("inputMode")).toBe("numeric");
    expect(getHidden("amount")).not.toBeNull();
  });

  it("groups thousands as the owner types 1,5,0,0,0,0 and submits plain digits", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    const steps = [
      ["1", "1"],
      ["15", "15"],
      ["150", "150"],
      ["1500", "1.500"],
      ["15000", "15.000"],
      ["150000", "150.000"],
    ] as const;
    for (const [typed, shown] of steps) {
      fireEvent.change(visible, { target: { value: typed } });
      expect(visible.value).toBe(shown);
    }
    expect(getHidden("amount").value).toBe("150000");
  });

  it("ignores a letter, dot, comma, dash or space -- nothing changes", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    fireEvent.change(visible, { target: { value: "150" } });
    expect(visible.value).toBe("150");

    for (const bad of ["150a", "150.", "150,", "150-", "150 "]) {
      fireEvent.change(visible, { target: { value: bad } });
      expect(visible.value).toBe("150");
    }
    expect(getHidden("amount").value).toBe("150");
  });

  it("accepts a paste of 150.000đ into an empty box", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    fireEvent.change(visible, { target: { value: "150.000đ" } });
    expect(visible.value).toBe("150.000");
    expect(getHidden("amount").value).toBe("150000");
  });

  it("removes one group on backspace from the end", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    fireEvent.change(visible, { target: { value: "150000" } });
    expect(visible.value).toBe("150.000");
    // Backspace from the end removes the last digit -- simulate the
    // browser's own edit of the field content before onChange fires.
    fireEvent.change(visible, { target: { value: "150.00" } });
    expect(visible.value).toBe("15.000");
    expect(getHidden("amount").value).toBe("15000");
  });

  it("shows an existing entry's amount grouped, with hidden plain digits", () => {
    render(<MoneyInput id="amount" name="amount" defaultValue={1728578} />);
    expect(getVisible().value).toBe("1.728.578");
    expect(getHidden("amount").value).toBe("1728578");
  });

  it("caps a 16th digit -- stays unchanged", () => {
    render(<MoneyInput id="amount" name="amount" defaultValue={"123456789012345"} />);
    const visible = getVisible();
    expect(visible.value).toBe("123.456.789.012.345");
    fireEvent.change(visible, { target: { value: "123.456.789.012.3456" } });
    expect(visible.value).toBe("123.456.789.012.345");
    expect(getHidden("amount").value).toBe("123456789012345");
  });

  it("typing only 0 leaves the box empty", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    fireEvent.change(visible, { target: { value: "0" } });
    expect(visible.value).toBe("");
    expect(getHidden("amount").value).toBe("");
  });

  it("empties when the form is reset", () => {
    render(
      <form>
        <MoneyInput id="amount" name="amount" defaultValue={150000} />
      </form>,
    );
    const visible = getVisible();
    expect(visible.value).toBe("150.000");
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.reset(form);
    expect(visible.value).toBe("");
    expect(getHidden("amount").value).toBe("");
  });

  it("shows a string defaultValue grouped, with hidden plain digits", () => {
    render(<MoneyInput id="amount" name="amount" defaultValue="1728578" />);
    expect(getVisible().value).toBe("1.728.578");
    expect(getHidden("amount").value).toBe("1728578");
  });
});

describe("BR-CASH-005 fix round 1", () => {
  // Item 1: a keystroke that would push a full 15-digit box over the cap
  // must be rejected whole, never truncated from the tail (which used to
  // silently change the number).
  it("rejects a mid-string insert that would push a full box over the 15-digit cap", () => {
    const full = "123456789012345"; // already at the 15-digit cap
    render(<MoneyInput id="amount" name="amount" defaultValue={full} />);
    const visible = getVisible();
    expect(visible.value).toBe("123.456.789.012.345");

    const setSelectionRangeSpy = vi.spyOn(HTMLInputElement.prototype, "setSelectionRange");
    // Caret right after the first dot (3 digits in), typing "9" there --
    // the browser inserts it and puts the caret right after it (index 5)
    // before firing change.
    Object.defineProperty(visible, "selectionStart", { value: 5, configurable: true });
    fireEvent.change(visible, { target: { value: "123.9456.789.012.345" } });

    expect(visible.value).toBe("123.456.789.012.345");
    expect(getHidden("amount").value).toBe(full);
    // Caret goes back to where it was before the rejected keystroke: 3
    // digits in.
    expect(setSelectionRangeSpy).toHaveBeenCalledWith(3, 3);
    setSelectionRangeSpy.mockRestore();
  });

  it("rejects a paste that would exceed the cap, rather than cutting it to 15 digits", () => {
    render(<MoneyInput id="amount" name="amount" />);
    const visible = getVisible();
    fireEvent.change(visible, { target: { value: "1234567890123456" } }); // 16 digits pasted at once
    expect(visible.value).toBe("");
    expect(getHidden("amount").value).toBe("");
  });

  // Item 2: caret wiring at integration level, the brief's own example --
  // "150.000", caret between "1" and "5", type "9" -> "1.950.000", caret 3.
  it("restores the caret after a mid-string insert (150.000 + 9 between 1 and 5)", () => {
    render(<MoneyInput id="amount" name="amount" defaultValue={150000} />);
    const visible = getVisible();
    expect(visible.value).toBe("150.000");

    const setSelectionRangeSpy = vi.spyOn(HTMLInputElement.prototype, "setSelectionRange");
    // The browser has already inserted "9" and moved the caret to just
    // after it (index 2) before firing change.
    Object.defineProperty(visible, "selectionStart", { value: 2, configurable: true });
    fireEvent.change(visible, { target: { value: "1950.000" } });

    expect(visible.value).toBe("1.950.000");
    expect(setSelectionRangeSpy).toHaveBeenCalledWith(3, 3);
    setSelectionRangeSpy.mockRestore();
  });

  // Item 3: Backspace/Delete landing on a dot must remove the neighbouring
  // digit, not silently do nothing.
  it("Backspace right after a dot removes the digit to its left", () => {
    render(<MoneyInput id="amount" name="amount" defaultValue={1500000} />);
    const visible = getVisible();
    expect(visible.value).toBe("1.500.000");

    // Caret right after the first dot; native Backspace deletes the dot
    // itself, landing the caret where the dot used to be (index 1).
    Object.defineProperty(visible, "selectionStart", { value: 1, configurable: true });
    fireEvent.input(visible, {
      target: { value: "1500.000" },
      inputType: "deleteContentBackward",
    });

    expect(visible.value).toBe("500.000");
    expect(getHidden("amount").value).toBe("500000");
  });

  it("Delete right before a dot removes the digit to its right", () => {
    render(<MoneyInput id="amount" name="amount" defaultValue={1500000} />);
    const visible = getVisible();
    expect(visible.value).toBe("1.500.000");

    // Caret right before the second dot; native Delete deletes the dot
    // itself, and Delete never moves the caret (stays at index 5).
    Object.defineProperty(visible, "selectionStart", { value: 5, configurable: true });
    fireEvent.input(visible, {
      target: { value: "1.500000" },
      inputType: "deleteContentForward",
    });

    expect(visible.value).toBe("150.000");
    expect(getHidden("amount").value).toBe("150000");
  });
});
