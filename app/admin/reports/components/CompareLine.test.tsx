// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CompareLine } from "./CompareLine";

afterEach(cleanup);

// BR-UI-007: one line under a card per compare period.
describe("CompareLine", () => {
  it.each([
    [12.5, "so với 01/09 – 09/09", "▲ 12.5% so với 01/09 – 09/09"],
    [-3.1, "so với thứ Sáu 02/10", "▼ 3.1% so với thứ Sáu 02/10"],
    [0, "so với hôm qua", "− 0.0% so với hôm qua"],
    [25, "so với hôm qua", "▲ 25.0% so với hôm qua"],
    // a change that rounds to 0.0 reads as no change, not as a tiny rise
    [0.04, "so với hôm qua", "− 0.0% so với hôm qua"],
    [-0.04, "so với hôm qua", "− 0.0% so với hôm qua"],
  ])("change %s reads as the arrow, one decimal and the period", (change, label, text) => {
    const { container } = render(<CompareLine change={change} label={label} />);
    expect(container.textContent?.replace(/\s+/g, " ").trim()).toBe(text);
  });

  it("no figure in the period before: says so and still names the period", () => {
    const { container } = render(<CompareLine change={null} label="so với thứ Sáu 02/10" />);
    expect(container.textContent?.replace(/\s+/g, " ").trim()).toBe("Kỳ trước chưa có số · so với thứ Sáu 02/10");
    expect(container.textContent).not.toContain("%");
  });
});
