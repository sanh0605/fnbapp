// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MoneySummary } from "./MoneySummary";

afterEach(cleanup);

// Spec 2.5: white box, grey label left, figure right, the main figure last.
describe("BR-UI-005 MoneySummary", () => {
  it("shows every line in order and the total last", () => {
    const { container } = render(
      <MoneySummary
        lines={[
          { label: "Tiền hàng", value: "52,773,374đ" },
          { label: "Phí vận chuyển", value: "648,200đ" },
        ]}
        total={{ label: "Đã trả", value: "49,149,880đ" }}
      />,
    );
    const text = container.textContent ?? "";
    const order = ["Tiền hàng", "52,773,374đ", "Phí vận chuyển", "648,200đ", "Đã trả", "49,149,880đ"].map(s =>
      text.indexOf(s),
    );
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is a white box with a thin border, not the grey that looks locked", () => {
    const { container } = render(<MoneySummary lines={[]} total={{ label: "Tổng", value: "0đ" }} />);
    const boxClass = (container.firstElementChild as HTMLElement).className;
    expect(boxClass).toContain("bg-surface-card");
    expect(boxClass).toContain("border-border");
    expect(boxClass).not.toContain("bg-surface-secondary");
  });

  it("the total stands out", () => {
    render(<MoneySummary lines={[{ label: "Tiền hàng", value: "1đ" }]} total={{ label: "Đã trả", value: "2đ" }} />);
    expect(screen.getByText("2đ").className).toMatch(/\bfont-(bold|semibold)\b/);
  });
});
