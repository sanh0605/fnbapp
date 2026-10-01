// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { PriceHistoryView } from "./PriceHistoryView";

afterEach(() => {
  cleanup();
});

describe("PriceHistoryView", () => {
  it("renders empty message when priceHistory is empty", () => {
    render(<PriceHistoryView priceHistory={[]} />);
    expect(screen.getByText("Chưa có lịch sử thay đổi nào.")).toBeInTheDocument();
  });

  it("renders rows with price and 'Đang áp dụng' badge for the current row", () => {
    const history = [
      {
        id: "PH-002",
        variant_id: "VAR-001",
        old_price: 20000,
        new_price: 25000,
        effective_at: "2026-05-01T00:00:00Z",
        created_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "PH-001",
        variant_id: "VAR-001",
        old_price: null,
        new_price: 20000,
        effective_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(<PriceHistoryView priceHistory={history} />);
    expect(screen.queryByText("Chưa có lịch sử thay đổi nào.")).toBeNull();
    expect(screen.getByText("Đang áp dụng")).toBeInTheDocument();
    expect(screen.getByText("25.000")).toBeInTheDocument();
    expect(screen.getByText("20.000")).toBeInTheDocument();
  });
});
