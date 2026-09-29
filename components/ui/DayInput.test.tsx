// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DayInput } from "./DayInput";

// that component calls window.matchMedia in a mount effect, which jsdom
// does not implement. Same stub as components/ProductForm.test.tsx.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

describe("DayInput", () => {
  it("shows the stored day as dd/mm/yyyy", () => {
    render(<DayInput label="Từ ngày" value="2026-09-01" onChange={() => {}} />);
    expect((screen.getByLabelText("Từ ngày") as HTMLInputElement).value).toBe("01/09/2026");
  });
  it("reports a typed day as YYYY-MM-DD on blur", () => {
    const onChange = vi.fn();
    render(<DayInput label="Từ ngày" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Từ ngày");
    fireEvent.change(input, { target: { value: "23/09/2026" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("2026-09-23");
  });
  it("reports an impossible day as invalid", () => {
    const onChange = vi.fn();
    render(<DayInput label="Từ ngày" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Từ ngày");
    fireEvent.change(input, { target: { value: "31/02/2026" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("invalid");
  });
  it("reports an emptied box as no filter", () => {
    const onChange = vi.fn();
    render(<DayInput label="Từ ngày" value="2026-09-01" onChange={onChange} />);
    const input = screen.getByLabelText("Từ ngày");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
