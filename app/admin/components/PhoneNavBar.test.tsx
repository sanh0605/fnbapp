// @vitest-environment jsdom
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { PhoneNavBar } from "./PhoneNavBar";

afterEach(cleanup);

let mockPathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "Admin User", role: "Admin" } } }),
  signOut: vi.fn(),
}));

describe("PhoneNavBar", () => {
  beforeEach(() => {
    mockPathname = "/admin";
  });

  it("opens and closes MoreSheet when clicking Thêm and pressing Escape", async () => {
    const onOpenPos = vi.fn();
    render(<PhoneNavBar onOpenPos={onOpenPos} />);
    
    const themButton = screen.getByText("Thêm");
    
    // click Thêm
    fireEvent.click(themButton);
    
    // Wait for MoreSheet effects
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    
    // press Escape
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    
    // click Thêm again
    fireEvent.click(themButton);
    
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
