// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

afterEach(cleanup);
import { SearchableSelect } from "./SearchableSelect";
import React from "react";

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

Element.prototype.scrollIntoView = vi.fn();

describe("SearchableSelect", () => {
  it("renders selected option and opens portal on click", () => {
    const options = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
    ];
    const onChange = vi.fn();

    render(
      <div className="overflow-x-auto">
        <SearchableSelect options={options} value="1" onChange={onChange} />
      </div>
    );

    expect(screen.getByText("Option 1")).toBeInTheDocument();

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    // The portal should be appended to document.body
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    
    // Check if it's in body, meaning its parent chain goes to body, not the div
    expect(listbox.closest(".overflow-x-auto")).toBeNull();

    // Click an option
    const option2 = screen.getByText("Option 2");
    fireEvent.click(option2);

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("renders trigger box with shared height classes, text-base, md:text-sm, and rounded-button matching Select", () => {
    const options = [
      { id: "1", label: "Option 1" },
    ];
    render(<SearchableSelect options={options} value="1" onChange={() => {}} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.className).toContain("min-h-[48px]");
    expect(trigger.className).toContain("md:min-h-[40px]");
    expect(trigger.className).toContain("text-base");
    expect(trigger.className).toContain("md:text-sm");
    expect(trigger.className).toContain("rounded-button");
  });

  it("does not close when clicking inside portal list", () => {
    const options = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
    ];
    const onChange = vi.fn();

    render(<SearchableSelect options={options} value="1" onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const input = screen.getByRole("textbox", { name: "Tìm trong danh sách" });
    fireEvent.mouseDown(input);
    
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("dispatches bubbling native change event to form on pick, but not on open/close without picking", () => {
    const options = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
    ];
    const onFormChange = vi.fn();
    const onChange = vi.fn();

    render(
      <form data-testid="f">
        <SearchableSelect options={options} value="1" onChange={onChange} />
      </form>
    );

    const form = screen.getByTestId("f");
    form.addEventListener("change", onFormChange);

    const trigger = screen.getByRole("combobox");

    // Open and close without picking: not called
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onFormChange).not.toHaveBeenCalled();

    // Reopen and pick an option: called once
    fireEvent.click(trigger);
    const option2 = screen.getByText("Option 2");
    fireEvent.click(option2);

    expect(onChange).toHaveBeenCalledWith("2");
    expect(onFormChange).toHaveBeenCalledTimes(1);
  });

  it("dispatches bubbling native change event to form when picking with keyboard", () => {
    const options = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
    ];
    const onFormChange = vi.fn();
    const onChange = vi.fn();

    render(
      <form data-testid="f">
        <SearchableSelect options={options} value="1" onChange={onChange} />
      </form>
    );

    const form = screen.getByTestId("f");
    form.addEventListener("change", onFormChange);

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const input = screen.getByRole("textbox", { name: "Tìm trong danh sách" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("2");
    expect(onFormChange).toHaveBeenCalledTimes(1);
  });

  it("shows placeholder text in muted text colour when no value is chosen", () => {
    render(<SearchableSelect options={[{ id: "1", label: "Option 1" }]} value="" onChange={() => {}} placeholder="Chọn..." />);
    const placeholder = screen.getByText("Chọn...");
    expect(placeholder.className).toContain("text-text-muted");
  });
});

// BR-UI-010 (2026-10-08): a long name in a pick list is shown whole. The owner
// could not read the end of long item names, which were cut with "…".
describe("SearchableSelect long names (BR-UI-010)", () => {
  const longName = "Cà phê hạt Robusta rang mộc Cầu Đất túi 500g loại đặc biệt";
  const options = [
    { id: "SPM-1", label: longName },
    { id: "SPM-2", label: "Trứng gà" },
  ];

  it("option rows wrap instead of cutting the name", () => {
    render(<SearchableSelect options={options} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    for (const row of screen.getAllByRole("option")) {
      expect(row.className).not.toMatch(/\btruncate\b/);
      expect(row.className).toMatch(/\bwhitespace-normal\b/);
      expect(row.className).toMatch(/\bbreak-words\b/);
    }
  });

  it("the chosen name in the closed box shows up to two lines, not one cut line", () => {
    render(<SearchableSelect options={options} value="SPM-1" onChange={() => {}} />);
    const label = screen.getByText(longName);
    expect(label.className).not.toMatch(/\btruncate\b/);
    expect(label.className).toMatch(/\bline-clamp-2\b/);
  });

  it("the open list may be wider than the box on a computer", () => {
    render(<SearchableSelect options={options} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    let panel = screen.getByRole("listbox").parentElement as HTMLElement;
    while (panel && !panel.className.includes("z-[110]")) panel = panel.parentElement as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.className).toMatch(/\bmd:max-w-\[28rem\]/);
    // A fixed width would pin it to the box; the panel sets a minimum instead.
    expect(panel.style.width).toBe("");
  });

  it("the search box shows a real name from the list as its example", () => {
    render(<SearchableSelect options={options} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("textbox", { name: "Tìm trong danh sách" }).getAttribute("placeholder")).toBe(`Ví dụ: ${longName}`);
  });

  it("with nothing to pick the search box says \"Gõ để tìm\"", () => {
    render(<SearchableSelect options={[]} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("textbox", { name: "Tìm trong danh sách" }).getAttribute("placeholder")).toBe("Gõ để tìm");
  });
});

// K3 review finding 8: on first open the panel was measured before it was
// placed, so a box near the right edge had its list pushed away from it.
describe("SearchableSelect panel placement (BR-UI-010)", () => {
  it("a 300px list under a box at x=900 on a 1280px screen opens at x=900", () => {
    const original = Element.prototype.getBoundingClientRect;
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const box = (x: number, y: number, w: number, h: number) =>
        ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect;
      if (this.getAttribute("role") === "combobox") return box(900, 100, 200, 40);
      if (this.className?.toString().includes("z-[110]")) return box(0, 0, 300, 200);
      return box(0, 0, 0, 0);
    };
    try {
      render(<SearchableSelect options={[{ id: "1", label: "Trứng gà" }]} value="" onChange={() => {}} />);
      fireEvent.click(screen.getByRole("combobox"));
      let panel = screen.getByRole("listbox").parentElement as HTMLElement;
      while (panel && !panel.className.includes("z-[110]")) panel = panel.parentElement as HTMLElement;
      expect(panel.style.left).toBe("900px");
    } finally {
      Element.prototype.getBoundingClientRect = original;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });
});
