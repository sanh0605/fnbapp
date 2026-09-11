// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
});
