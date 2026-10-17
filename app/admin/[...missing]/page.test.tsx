import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminCatchAllPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("AdminCatchAllPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound and throws NEXT_NOT_FOUND", () => {
    expect(() => AdminCatchAllPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
