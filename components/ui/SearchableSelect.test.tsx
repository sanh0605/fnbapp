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
