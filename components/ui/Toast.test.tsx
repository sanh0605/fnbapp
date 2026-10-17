// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastStack, type ToastItem } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ToastStack", () => {
  it("renders the notice region with correct role and aria attributes", () => {
    render(<ToastStack toasts={[]} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Thông báo" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-label", "Thông báo");
  });

  it("calls onDismiss after 3 s for success, and does not dismiss error after 10 s", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const toasts: ToastItem[] = [
      { id: "s1", kind: "success", title: "Thanh toán thành công" },
      { id: "e1", kind: "error", title: "Chưa gửi được đơn" },
    ];

    render(<ToastStack toasts={toasts} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith("s1");

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalledWith("e1");
  });

  it("calls onDismiss after 3 s for info and 5 s for warning", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const toasts: ToastItem[] = [
      { id: "i1", kind: "info", title: "Đã có mạng trở lại" },
      { id: "w1", kind: "warning", title: "Lưu nháp hoặc thanh toán trước khi đăng xuất" },
    ];

    render(<ToastStack toasts={toasts} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith("i1");

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenCalledWith("w1");
  });

  it("✕ button calls onDismiss(id) and cancels the timer", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const toasts: ToastItem[] = [
      { id: "t1", kind: "warning", title: "Cảnh báo" },
    ];

    render(<ToastStack toasts={toasts} onDismiss={onDismiss} />);
    const closeBtn = screen.getByRole("button", { name: "Đóng" });

    act(() => {
      fireEvent.click(closeBtn);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith("t1");

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders title and detail as <p> elements", () => {
    const toasts: ToastItem[] = [
      { id: "1", kind: "error", title: "Chưa gửi được đơn", detail: "Lỗi kết nối máy chủ" },
    ];

    render(<ToastStack toasts={toasts} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Thông báo" });
    const paragraphs = region.querySelectorAll("p");

    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].tagName).toBe("P");
    expect(paragraphs[0].textContent).toBe("Chưa gửi được đơn");
    expect(paragraphs[1].tagName).toBe("P");
    expect(paragraphs[1].textContent).toBe("Lỗi kết nối máy chủ");
  });

  it("omits detail element when detail is not provided", () => {
    const toasts: ToastItem[] = [
      { id: "1", kind: "success", title: "Thanh toán thành công" },
    ];

    render(<ToastStack toasts={toasts} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Thông báo" });
    const paragraphs = region.querySelectorAll("p");

    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0].textContent).toBe("Thanh toán thành công");
  });

  it("clears timers on unmount", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const toasts: ToastItem[] = [
      { id: "s1", kind: "success", title: "Thanh toán thành công" },
    ];

    const { unmount } = render(<ToastStack toasts={toasts} onDismiss={onDismiss} />);
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("contains no emoji in rendered output", () => {
    const toasts: ToastItem[] = [
      { id: "1", kind: "success", title: "Thành công" },
      { id: "2", kind: "error", title: "Lỗi" },
      { id: "3", kind: "warning", title: "Cảnh báo" },
      { id: "4", kind: "info", title: "Thông tin" },
    ];

    render(<ToastStack toasts={toasts} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Thông báo" });
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    expect(region.textContent).not.toMatch(emojiRegex);
    expect(region.textContent).not.toContain("🟢");
    expect(region.textContent).not.toContain("🔴");
    expect(region.textContent).not.toContain("⚠️");
    expect(region.textContent).not.toContain("ℹ️");
  });
});
