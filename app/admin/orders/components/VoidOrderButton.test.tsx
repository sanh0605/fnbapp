// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { VoidOrderButton } from "./VoidOrderButton";
import { voidOrderV2 } from "@/app/admin/orders/actions";

vi.mock("@/app/admin/orders/actions", () => ({
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
  it("renders Hủy đơn button and opens confirmation box on click", () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    const button = screen.getByRole("button", { name: "Hủy đơn" });
    expect(button).toBeDefined();

    expect(screen.queryByLabelText("Lý do hủy đơn")).toBeNull();

    fireEvent.click(button);
    expect(screen.getByLabelText("Lý do hủy đơn")).toBeDefined();
    expect(screen.getByText("ORD000001")).toBeDefined();
  });

  it("locks Đồng ý hủy button when reason is empty, unlocks when typed", () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));

    const confirmButton = screen.getByRole("button", { name: "Đồng ý hủy" });
    expect(confirmButton).toBeDisabled();

    const textarea = screen.getByLabelText("Lý do hủy đơn");
    fireEvent.change(textarea, { target: { value: "Khách hủy bàn" } });
    expect(confirmButton).not.toBeDisabled();
  });

  it("calls voidOrderV2 with orderId and reason, calls onVoided on success", async () => {
    const onVoided = vi.fn();
    vi.mocked(voidOrderV2).mockResolvedValueOnce({ success: true });

    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" onVoided={onVoided} />);
    fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));

    const textarea = screen.getByLabelText("Lý do hủy đơn");
    fireEvent.change(textarea, { target: { value: "Khách đổi ý" } });

    const confirmButton = screen.getByRole("button", { name: "Đồng ý hủy" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(voidOrderV2).toHaveBeenCalledWith("ORD-1", "Khách đổi ý");
      expect(onVoided).toHaveBeenCalled();
    });
  });

  it("shows error message when voidOrderV2 fails", async () => {
    vi.mocked(voidOrderV2).mockResolvedValueOnce({
      success: false,
      error: "Không thể hủy đơn này",
    });

    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));

    const textarea = screen.getByLabelText("Lý do hủy đơn");
    fireEvent.change(textarea, { target: { value: "Lỗi pha chế" } });

    fireEvent.click(screen.getByRole("button", { name: "Đồng ý hủy" }));

    await waitFor(() => {
      expect(screen.getByText("Lỗi hủy đơn: Không thể hủy đơn này")).toBeDefined();
    });
  });

  it("closes modal without calling voidOrderV2 when Hủy bỏ is clicked", () => {
    render(<VoidOrderButton orderId="ORD-1" orderNo="ORD000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));

    expect(screen.getByLabelText("Lý do hủy đơn")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Hủy bỏ" }));

    expect(screen.queryByLabelText("Lý do hủy đơn")).toBeNull();
    expect(voidOrderV2).not.toHaveBeenCalled();
  });
});
