// @vitest-environment jsdom
//
// Wave K4 (BR-UI-008, spec 2.2): the per-line discount box on the order edit
// page is the shared number box. A 12.5% discount on a 50,000đ line leaves
// 43,750đ, exactly as the old box computed it, and Lưu hands the page 12.5.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { LineItemEditor, type EditItem } from "./LineItemEditor";

afterEach(() => cleanup());

const ITEM: EditItem = {
  product_id: "PROD-001",
  product_name: "Cà phê sữa",
  variant_id: "VAR-001",
  size_name: "M",
  unit_price: 25000,
  qty: 2,
  modifiers: [],
  discount_amount: 0,
  line_discount: 0,
  line_promo_discount: 0,
  line_order_discount_allocation: 0,
  line_manual_discount: 0,
  discount_type: "PERCENT",
} as EditItem;

const VARIANTS = [{ id: "VAR-001", product_id: "PROD-001", size_name: "M", price: 25000 }];

function renderEditing(onSaveEdit = vi.fn()) {
  render(
    <LineItemEditor
      item={ITEM}
      idx={0}
      isEditing
      variants={VARIANTS}
      groupedModifiers={{}}
      onStartEdit={vi.fn()}
      onCancelEdit={vi.fn()}
      onSaveEdit={onSaveEdit}
      onRemove={vi.fn()}
    />,
  );
  return onSaveEdit;
}

const box = () => screen.getByLabelText("Số tiền giảm giá món hàng") as HTMLInputElement;

describe("LineItemEditor -- discount box (wave K4)", () => {
  it("12.5% on a 50,000đ line leaves 43,750 and saves 12.5", () => {
    const onSaveEdit = renderEditing();
    expect(box().type).toBe("text");
    fireEvent.change(box(), { target: { value: "12.5" } });
    expect(box().value).toBe("12.5");
    expect(document.body.textContent).toContain("43,750");
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSaveEdit).toHaveBeenCalledWith(0, expect.objectContaining({ discount_amount: 12.5, discount_type: "PERCENT" }));
  });

  it("a percentage above 100 is refused under the box", () => {
    renderEditing();
    fireEvent.change(box(), { target: { value: "120" } });
    fireEvent.blur(box());
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
  });
});

// Review of wave K4: the line editor sits inside the order's <form>. Its own
// "Hủy" and "Lưu" only close the line; they must never save the whole order.
describe("LineItemEditor -- line buttons inside the order form", () => {
  it.each(["Hủy", "Lưu"])("the line's %s does not submit the order", (name) => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <LineItemEditor
          item={ITEM}
          idx={0}
          isEditing
          variants={VARIANTS}
          groupedModifiers={{}}
          onStartEdit={vi.fn()}
          onCancelEdit={vi.fn()}
          onSaveEdit={vi.fn()}
          onRemove={vi.fn()}
        />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
