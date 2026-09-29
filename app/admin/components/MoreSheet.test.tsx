// @vitest-environment jsdom
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import { MoreSheet } from "./MoreSheet";
import { NAV_GROUPS } from "../nav-items";

afterEach(cleanup);

let mockPathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "Admin User", role: "Admin" } } }),
  signOut: vi.fn(),
}));

function Wrapper() {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? <MoreSheet onClose={() => setIsOpen(false)} /> : null;
}

describe("MoreSheet", () => {
  beforeEach(() => {
    mockPathname = "/admin";
  });

  it("is still in the document after render and flushing effects/microtasks", async () => {
    render(<Wrapper />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<Wrapper />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes on pathname change", async () => {
    const { rerender } = render(<Wrapper />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    mockPathname = "/admin/orders";
    rerender(<Wrapper />);
    
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on popstate", async () => {
    render(<Wrapper />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an item from every one of the 6 groups", async () => {
    render(<Wrapper />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    for (const group of NAV_GROUPS) {
      if (!group.children) continue;
      expect(screen.getAllByText(group.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(group.children[0].name).length).toBeGreaterThan(0);
    }
    expect(screen.queryAllByText('Tổng quan')).toHaveLength(0);
  });
});
