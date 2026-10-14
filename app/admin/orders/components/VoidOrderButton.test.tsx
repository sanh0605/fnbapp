// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VoidOrderButton } from "./VoidOrderButton";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("VoidOrderButton", () => {
  it('"Huỷ đơn" opens a void step, so it wears the Xoá look: red outline, no class overrides (spec 2.1)', () => {
    render(<VoidOrderButton orderId="ORD-1" />);
    const link = screen.getByRole("link", { name: "Huỷ đơn" });
    const classes = link.className.split(/\s+/);
    expect(classes).toContain("border-danger");
    expect(classes).toContain("text-danger");
    expect(classes.filter((c) => c.startsWith("!"))).toEqual([]);
  });

  it("links to the void page for the order without popup", () => {
    render(<VoidOrderButton orderId="ORD-1" />);
    const link = screen.getByRole("link", { name: "Huỷ đơn" });
    expect(link.getAttribute("href")).toBe("/admin/orders/ORD-1/void");
    expect(screen.queryByLabelText("Lý do huỷ đơn")).toBeNull();
  });

  it("preserves returnTo in the void page URL", () => {
    const returnTo = "/admin/orders?payment=Tien+mat&page=2";
    render(
      <VoidOrderButton
        orderId="ORD-1"
       
        returnTo={returnTo}
      />
    );
    const link = screen.getByRole("link", { name: "Huỷ đơn" });
    expect(link.getAttribute("href")).toBe(
      `/admin/orders/ORD-1/void?returnTo=${encodeURIComponent(returnTo)}`
    );
  });

});
