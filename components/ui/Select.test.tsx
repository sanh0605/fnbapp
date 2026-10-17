// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { Select } from "./Select";

afterEach(cleanup);

describe("Select", () => {
  it("renders visible select box with shared height classes min-h-[48px] and md:min-h-[40px]", () => {
    render(
      <Select aria-label="Lựa chọn">
        <option value="1">Một</option>
      </Select>
    );
    const select = screen.getByRole("combobox");
    expect(select.className).toContain("min-h-[48px]");
    expect(select.className).toContain("md:min-h-[40px]");
    expect(select.className).toContain("text-base");
    expect(select.className).toContain("md:text-sm");
    expect(select.className).toContain("appearance-none");
  });

  it("renders the chevron svg matching SearchableSelect", () => {
    const { container } = render(
      <Select aria-label="Lựa chọn">
        <option value="1">Một</option>
      </Select>
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.className.baseVal ?? svg?.getAttribute("class")).toContain("text-text-muted");
    const path = svg?.querySelector("path");
    expect(path).toHaveAttribute("d", "M19 9l-7 7-7-7");
  });
});
