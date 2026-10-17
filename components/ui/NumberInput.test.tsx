// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "./NumberInput";

afterEach(cleanup);

function box(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

function hidden(name: string): HTMLInputElement {
  return document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement;
}

const COMMA_HINT = "Số lẻ dùng dấu chấm, ví dụ 1.5";

describe("BR-UI-005 NumberInput: typing (spec 2.2)", () => {
  it("is a plain text box: decimal keypad when it takes decimals, number keypad when not", () => {
    render(<NumberInput id="qty" decimals={3} />);
    expect(box().getAttribute("type")).toBe("text");
    expect(box().getAttribute("inputMode")).toBe("decimal");
    cleanup();
    render(<NumberInput id="count" decimals={0} />);
    expect(box().getAttribute("inputMode")).toBe("numeric");
  });

  it("shows 1250.5 as 1,250.5 and posts 1250.5", () => {
    render(<NumberInput id="qty" name="qty" decimals={3} />);
    fireEvent.change(box(), { target: { value: "1250.5" } });
    expect(box().value).toBe("1,250.5");
    expect(hidden("qty").value).toBe("1250.5");
  });

  it("posts 5, not 5., while a trailing dot is still on screen", () => {
    render(<NumberInput id="qty" name="qty" decimals={3} />);
    fireEvent.change(box(), { target: { value: "5." } });
    expect(box().value).toBe("5.");
    expect(hidden("qty").value).toBe("5");
  });

  it("keeps the caret right after the digit typed when a comma appears", () => {
    render(<NumberInput id="qty" decimals={3} defaultValue={125} />);
    const spy = vi.spyOn(HTMLInputElement.prototype, "setSelectionRange");
    Object.defineProperty(box(), "selectionStart", { value: 4, configurable: true });
    fireEvent.change(box(), { target: { value: "1250" } });
    expect(box().value).toBe("1,250");
    expect(spy).toHaveBeenCalledWith(5, 5);
    spy.mockRestore();
  });

  it("refuses a 4th decimal: the box keeps 1.234", () => {
    render(<NumberInput id="qty" decimals={3} defaultValue={1.234} />);
    fireEvent.change(box(), { target: { value: "1.2345" } });
    expect(box().value).toBe("1.234");
  });

  it("drops a minus sign: no negative numbers", () => {
    render(<NumberInput id="qty" decimals={3} />);
    fireEvent.change(box(), { target: { value: "-5" } });
    expect(box().value).toBe("5");
  });

  it("the mouse wheel never changes the number", () => {
    render(<NumberInput id="qty" decimals={3} defaultValue={12} />);
    fireEvent.wheel(box(), { deltaY: -100 });
    expect(box().value).toBe("12");
  });

  it("opens a stored 2.5 as 2.5, with a dot", () => {
    render(<NumberInput id="qty" decimals={3} defaultValue={2.5} />);
    expect(box().value).toBe("2.5");
  });

  it("empties when the form is reset", () => {
    render(
      <form>
        <NumberInput id="qty" name="qty" decimals={3} defaultValue={1250} />
      </form>,
    );
    fireEvent.reset(document.querySelector("form") as HTMLFormElement);
    expect(box().value).toBe("");
    expect(hidden("qty").value).toBe("");
  });
});

describe("BR-UI-005 NumberInput: what the box shows besides the number", () => {
  it("a grey example that matches the box: 1,250.5 with decimals, 12 without, or the page's own", () => {
    render(<NumberInput id="a" decimals={3} />);
    expect(box().getAttribute("placeholder")).toBe("Ví dụ: 1,250.5");
    cleanup();
    render(<NumberInput id="b" decimals={0} />);
    expect(box().getAttribute("placeholder")).toBe("Ví dụ: 12");
    cleanup();
    render(<NumberInput id="c" decimals={0} example="150,000" />);
    expect(box().getAttribute("placeholder")).toBe("Ví dụ: 150,000");
  });

  it("the unit sits inside the box", () => {
    render(<NumberInput id="qty" decimals={3} unit="ml" />);
    expect(screen.getByText("ml")).toBeInTheDocument();
  });

  it("a hint shows under the box, and an error from the page takes its place", () => {
    const { rerender } = render(<NumberInput id="qty" decimals={3} hint="Tồn hiện tại: 3,200 ml" />);
    expect(screen.getByText("Tồn hiện tại: 3,200 ml")).toBeInTheDocument();
    expect(box().getAttribute("aria-invalid")).not.toBe("true");

    rerender(<NumberInput id="qty" decimals={3} hint="Tồn hiện tại: 3,200 ml" error="Vượt tồn hiện tại 3,200 ml." />);
    expect(screen.queryByText("Tồn hiện tại: 3,200 ml")).not.toBeInTheDocument();
    const message = screen.getByText("Vượt tồn hiện tại 3,200 ml.");
    expect(box().getAttribute("aria-invalid")).toBe("true");
    expect(box().getAttribute("aria-describedby")).toBe(message.id);
  });
});

describe("BR-UI-008 NumberInput: a comma typed into a decimal box (owner 2026-10-08)", () => {
  it("drops the comma, says to use a dot, and the next comma-free keystroke clears the line", () => {
    render(<NumberInput id="qty" decimals={3} />);
    fireEvent.change(box(), { target: { value: "1" } });
    fireEvent.change(box(), { target: { value: "1," } });
    expect(box().value).toBe("1");
    expect(screen.getByText(COMMA_HINT)).toBeInTheDocument();

    fireEvent.change(box(), { target: { value: "15" } });
    expect(screen.queryByText(COMMA_HINT)).not.toBeInTheDocument();
  });

  it("an already grouped paste of 1,250.5 is not a mistake: no line", () => {
    render(<NumberInput id="qty" decimals={3} />);
    fireEvent.change(box(), { target: { value: "1,250.5" } });
    expect(box().value).toBe("1,250.5");
    expect(screen.queryByText(COMMA_HINT)).not.toBeInTheDocument();
  });

  it("a whole-number box never shows the line", () => {
    render(<NumberInput id="amount" decimals={0} />);
    fireEvent.change(box(), { target: { value: "1" } });
    fireEvent.change(box(), { target: { value: "1," } });
    expect(screen.queryByText(COMMA_HINT)).not.toBeInTheDocument();
  });
});

describe("BR-UI-005 NumberInput: mistakes show under the box, never in a bubble", () => {
  it("an empty required box says Cần nhập số. when the form is sent, and stops the browser's bubble", () => {
    render(<NumberInput id="qty" decimals={3} required />);
    const event = new Event("invalid", { cancelable: true });
    act(() => {
      box().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByText("Cần nhập số.")).toBeInTheDocument();
  });

  it("0 in a box that must be above 0 says Nhập số lớn hơn 0. on leaving it", () => {
    render(<NumberInput id="qty" decimals={3} min={0} minExclusive />);
    fireEvent.change(box(), { target: { value: "0" } });
    expect(screen.queryByText("Nhập số lớn hơn 0.")).not.toBeInTheDocument();
    fireEvent.blur(box());
    expect(screen.getByText("Nhập số lớn hơn 0.")).toBeInTheDocument();
  });

  it("1 under a minimum of 2 says Nhập số từ 2 trở lên.", () => {
    render(<NumberInput id="qty" decimals={0} min={2} />);
    fireEvent.change(box(), { target: { value: "1" } });
    fireEvent.blur(box());
    expect(screen.getByText("Nhập số từ 2 trở lên.")).toBeInTheDocument();
  });

  it("above the maximum: the page's sentence, or Nhập số không quá 3,200.", () => {
    render(<NumberInput id="a" decimals={3} max={3200} maxMessage="Vượt tồn hiện tại 3,200 ml." />);
    fireEvent.change(box(), { target: { value: "4000" } });
    fireEvent.blur(box());
    expect(screen.getByText("Vượt tồn hiện tại 3,200 ml.")).toBeInTheDocument();
    cleanup();

    render(<NumberInput id="b" decimals={3} max={3200} />);
    fireEvent.change(box(), { target: { value: "4000" } });
    fireEvent.blur(box());
    expect(screen.getByText("Nhập số không quá 3,200.")).toBeInTheDocument();
  });

  it("shows max message while typing above limit, before blur, and removes it when back within limit", () => {
    render(<NumberInput id="qty" decimals={0} max={100} />);
    fireEvent.change(box(), { target: { value: "150" } });
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: "50" } });
    expect(screen.queryByText("Nhập số không quá 100.")).not.toBeInTheDocument();
  });

  it("keeps the message when a typed character is refused", () => {
    render(<NumberInput id="qty" decimals={2} max={100} />);
    fireEvent.change(box(), { target: { value: "150.12" } });
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: "150.123" } });
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
  });

  it("typing again clears the message", () => {
    render(<NumberInput id="qty" decimals={0} min={2} />);
    fireEvent.change(box(), { target: { value: "1" } });
    fireEvent.blur(box());
    expect(screen.getByText("Nhập số từ 2 trở lên.")).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: "12" } });
    expect(screen.queryByText("Nhập số từ 2 trở lên.")).not.toBeInTheDocument();
  });
});

describe("BR-UI-005 NumberInput: the page holds the number", () => {
  function Held({ initial, onValue }: { initial: number | null; onValue: (v: number | null) => void }) {
    const [value, setValue] = useState<number | null>(initial);
    return (
      <>
        <NumberInput
          id="qty"
          decimals={3}
          value={value}
          onValueChange={(v: number | null) => {
            setValue(v);
            onValue(v);
          }}
        />
        <button type="button" onClick={() => setValue(2.5)}>
          Đặt 2.5
        </button>
      </>
    );
  }

  it("reports 5 for 5. and the box keeps 5. while the user goes on typing", () => {
    const onValue = vi.fn();
    render(<Held initial={null} onValue={onValue} />);
    fireEvent.change(box(), { target: { value: "5." } });
    expect(onValue).toHaveBeenLastCalledWith(5);
    expect(box().value).toBe("5.");
  });

  it("follows a new number the page sets", () => {
    render(<Held initial={1} onValue={() => {}} />);
    expect(box().value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Đặt 2.5" }));
    expect(box().value).toBe("2.5");
  });

  it("reports null when the box is emptied", () => {
    const onValue = vi.fn();
    render(<Held initial={7} onValue={onValue} />);
    fireEvent.change(box(), { target: { value: "" } });
    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(box().value).toBe("");
  });
});

// Review of wave K4 (plan Hiện trạng 9): a promotion switched from đ to % with
// 15000 typed says so at once, not only after the box is left or saved.
describe("BR-UI-005 NumberInput: a limit that changes under the number", () => {
  it("says the new limit at once when max drops below the typed number", () => {
    const { rerender } = render(<NumberInput id="v" decimals={0} value={15000} onValueChange={() => {}} />);
    expect(screen.queryByText("Nhập số không quá 100.")).toBeNull();
    rerender(<NumberInput id="v" decimals={0} value={15000} onValueChange={() => {}} max={100} />);
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
  });

  it("drops the message when the limit is lifted again", () => {
    const { rerender } = render(<NumberInput id="v" decimals={0} value={15000} onValueChange={() => {}} />);
    rerender(<NumberInput id="v" decimals={0} value={15000} onValueChange={() => {}} max={100} />);
    rerender(<NumberInput id="v" decimals={0} value={15000} onValueChange={() => {}} />);
    expect(screen.queryByText("Nhập số không quá 100.")).toBeNull();
  });
});

describe("NumberInput height by device (owner 2026-10-11 trial)", () => {
  it("is 48px on a phone and 40px on a computer", () => {
    render(<NumberInput id="qty" decimals={0} />);
    const cls = box().className;
    expect(cls).toContain("min-h-[48px]");
    expect(cls).toContain("md:min-h-[40px]");
  });
});
