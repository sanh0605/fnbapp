// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import POSScreen from "./POSScreen";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn().mockResolvedValue([]),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(),
  reportPosSyncFailure: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@/lib/pos/pos-offline-queue", () => ({
  listPendingOrders: vi.fn().mockReturnValue([]),
  enqueuePendingOrder: vi.fn(),
  incrementAttemptCount: vi.fn(),
  removePendingOrder: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("POSScreen date label", () => {
  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z: shows 15/09/2026", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));

    render(
      <POSScreen
        categories={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
      />
    );

    expect(screen.getByText("15/09/2026")).toBeInTheDocument();
  });
});
