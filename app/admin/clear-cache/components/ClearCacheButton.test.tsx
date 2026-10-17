// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ClearCacheButton } from "./ClearCacheButton";
import { clearProductCache } from "../actions";
import ClearCachePage from "../page";

vi.mock("../actions", () => ({
  clearProductCache: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ClearCacheButton", () => {
  it("renders the refresh cache button without any initial alert", () => {
    render(<ClearCacheButton />);
    const button = screen.getByRole("button", { name: "Làm mới bộ nhớ đệm" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("w-full");
    expect(button.className).toContain("md:w-auto");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clicking the button calls clearProductCache once and shows success alert", async () => {
    vi.mocked(clearProductCache).mockResolvedValue(undefined);

    render(<ClearCacheButton />);
    const button = screen.getByRole("button", { name: "Làm mới bộ nhớ đệm" });

    fireEvent.click(button);

    await waitFor(() => {
      expect(clearProductCache).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const alert = screen.getByRole("status");
      expect(alert).toHaveTextContent("Đã làm mới bộ nhớ đệm.");
    });
  });

  it("shows danger alert when clearProductCache fails", async () => {
    vi.mocked(clearProductCache).mockRejectedValue(new Error("Unauthorized"));

    render(<ClearCacheButton />);
    const button = screen.getByRole("button", { name: "Làm mới bộ nhớ đệm" });

    fireEvent.click(button);

    await waitFor(() => {
      expect(clearProductCache).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Không làm mới được. Thử lại hoặc báo quản trị.");
    });
  });
});

describe("ClearCachePage", () => {
  it("renders PageHeader with required title and subtitle", () => {
    render(<ClearCachePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Xoá bộ nhớ đệm");
    expect(
      screen.getByText("Bấm nút dưới đây nếu món, giá hoặc biến thể vừa sửa chưa hiện đúng.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Làm mới bộ nhớ đệm" })).toBeInTheDocument();
  });
});
