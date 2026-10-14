// @vitest-environment jsdom
//
// Wave K4 (BR-UI-008, spec 2.2): the order-wide discount box on the order edit
// page is the shared number box. In đ mode it takes whole đồng and groups
// thousands; in % mode it takes up to two decimals and stops at 100. The page
// still receives a plain number, 0 when the box is empty, as before.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { DiscountEditor } from "./DiscountEditor";

afterEach(() => cleanup());

function Harness({ seen, type = "VND" }: { seen: number[]; type?: string }) {
  const [value, setValue] = useState(0);
  const [discountType, setDiscountType] = useState(type);
  return (
    <DiscountEditor
      orderDiscount={value}
      orderDiscountType={discountType}
      setOrderDiscount={(n) => { seen.push(n); setValue(n); }}
      setOrderDiscountType={setDiscountType}
    />
  );
}

const box = () => screen.getByLabelText("Số tiền giảm giá đơn hàng") as HTMLInputElement;

describe("DiscountEditor -- discount box (wave K4)", () => {
  it("in đ mode groups thousands and hands the page a whole number", () => {
    const seen: number[] = [];
    render(<Harness seen={seen} />);
    expect(box().type).toBe("text");
    expect(box().getAttribute("inputmode")).toBe("numeric");
    fireEvent.change(box(), { target: { value: "10000" } });
    expect(box().value).toBe("10,000");
    expect(seen.at(-1)).toBe(10000);
    expect(box().parentElement?.textContent).toContain("đ");
  });

  it("in % mode takes 12.5 and refuses 120 under the box", () => {
    const seen: number[] = [];
    render(<Harness seen={seen} type="PERCENT" />);
    expect(box().getAttribute("inputmode")).toBe("decimal");
    fireEvent.change(box(), { target: { value: "12.5" } });
    expect(box().value).toBe("12.5");
    expect(seen.at(-1)).toBe(12.5);
    fireEvent.change(box(), { target: { value: "120" } });
    fireEvent.blur(box());
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
  });

  it("an emptied box hands the page 0, as before", () => {
    const seen: number[] = [];
    render(<Harness seen={seen} />);
    fireEvent.change(box(), { target: { value: "5000" } });
    fireEvent.change(box(), { target: { value: "" } });
    expect(seen.at(-1)).toBe(0);
  });
});
