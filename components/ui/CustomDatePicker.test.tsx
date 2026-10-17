// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CustomDatePicker } from "./CustomDatePicker";

// jsdom has no ResizeObserver; the datepicker's popper needs one once it opens.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("CustomDatePicker", () => {
  it("renders correctly", () => {
    render(<CustomDatePicker selected={new Date()} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("dispatches bubbling native change event to form on pick, but not on open/close without picking", () => {
    const onFormChange = vi.fn();
    const onChange = vi.fn();

    const { container } = render(
      <form data-testid="f">
        <CustomDatePicker selected={new Date(2026, 9, 1)} onChange={onChange} />
      </form>
    );

    const form = screen.getByTestId("f");
    form.addEventListener("change", onFormChange);

    const input = container.querySelector("input")!;

    // Open and close without picking: blur
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onFormChange).not.toHaveBeenCalled();

    // Reopen and pick a day
    fireEvent.focus(input);
    const day = document.querySelector(".react-datepicker__day--015");
    expect(day).toBeTruthy();
    fireEvent.click(day!);

    expect(onChange).toHaveBeenCalled();
    expect(onFormChange).toHaveBeenCalledTimes(1);
  });

  it("renders visible input with shared height classes min-h-[48px] and md:min-h-[40px]", () => {
    const { container } = render(<CustomDatePicker selected={new Date()} onChange={vi.fn()} />);
    const input = container.querySelector("input")!;
    expect(input.className).toContain("min-h-[48px]");
    expect(input.className).toContain("md:min-h-[40px]");
    expect(input.className).toContain("text-sm");
  });

  it("renders clear button with house colours and touch target size", () => {
    const { container } = render(<CustomDatePicker selected={new Date()} onChange={vi.fn()} isClearable />);
    const closeBtn = container.querySelector(".react-datepicker__close-icon");
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn?.className).toContain("min-h-[48px]");
    expect(closeBtn?.className).toContain("md:min-h-[40px]");
    expect(closeBtn?.className).toContain("after:!text-text-secondary");
  });
});
