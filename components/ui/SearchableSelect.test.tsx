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

    const input = screen.getByPlaceholderText("Gõ để tìm kiếm…");
    fireEvent.mouseDown(input);
    
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
