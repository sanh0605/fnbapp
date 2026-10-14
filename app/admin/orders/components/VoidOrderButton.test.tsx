// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { VoidOrderButton } from "./VoidOrderButton";
import { voidOrderV2 } from "@/app/admin/orders/order-void-actions";

vi.mock("@/app/admin/orders/order-void-actions", () => ({
  voidOrderV2: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VoidOrderButton", () => {
  it('"Huỷ đơn" opens a void step, so it wears the Xoá look: red outline, no class overrides (spec 2.1)', () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    const classes = screen.getByRole("button", { name: "Huỷ đơn" }).className.split(/\s+/);
    expect(classes).toContain("border-danger");
    expect(classes).toContain("text-danger");
    expect(classes.filter(c => c.startsWith("!"))).toEqual([]);
  });

  it("renders Huỷ đơn button and opens confirmation box on click", () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    const button = screen.getByRole("button", { name: "Huỷ đơn" });
    expect(button).toBeDefined();

    expect(screen.queryByLabelText("Lý do huỷ đơn")).toBeNull();

    fireEvent.click(button);
    expect(screen.getByLabelText("Lý do huỷ đơn")).toBeDefined();
    expect(screen.getByText("ORD000001")).toBeDefined();
  });

  it("locks Đồng ý huỷ button when reason is empty, unlocks when typed", () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ đơn" }));

    const confirmButton = screen.getByRole("button", { name: "Đồng ý huỷ" });
    expect(confirmButton).toBeDisabled();

    const textarea = screen.getByLabelText("Lý do huỷ đơn");
    fireEvent.change(textarea, { target: { value: "Khách huỷ bàn" } });
    expect(confirmButton).not.toBeDisabled();
  });

  it("calls voidOrderV2 with orderId and reason, calls onVoided on success", async () => {
    const onVoided = vi.fn();
    vi.mocked(voidOrderV2).mockResolvedValueOnce({ success: true });

    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" onVoided={onVoided} />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ đơn" }));

    const textarea = screen.getByLabelText("Lý do huỷ đơn");
    fireEvent.change(textarea, { target: { value: "Khách đổi ý" } });

    const confirmButton = screen.getByRole("button", { name: "Đồng ý huỷ" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(voidOrderV2).toHaveBeenCalledWith("ORD-1", "Khách đổi ý");
      expect(onVoided).toHaveBeenCalled();
    });
  });

  it("shows error message when voidOrderV2 fails", async () => {
    vi.mocked(voidOrderV2).mockResolvedValueOnce({
      success: false,
      error: "Không thể huỷ đơn này",
    });

    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ đơn" }));

    const textarea = screen.getByLabelText("Lý do huỷ đơn");
    fireEvent.change(textarea, { target: { value: "Lỗi pha chế" } });

    fireEvent.click(screen.getByRole("button", { name: "Đồng ý huỷ" }));

    await waitFor(() => {
      expect(screen.getByText("Lỗi huỷ đơn: Không thể huỷ đơn này")).toBeDefined();
    });
  });

  it("closes modal without calling voidOrderV2 when Huỷ bỏ is clicked", () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ đơn" }));

    expect(screen.getByLabelText("Lý do huỷ đơn")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ bỏ" }));

    expect(screen.queryByLabelText("Lý do huỷ đơn")).toBeNull();
    expect(voidOrderV2).not.toHaveBeenCalled();
  });
});
