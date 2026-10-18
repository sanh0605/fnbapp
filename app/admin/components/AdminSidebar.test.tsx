// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "./AdminSidebar";

window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "tuyen2612", role: "MANAGER" } } }),
  signOut: vi.fn(),
}));

describe("AdminSidebar account name", () => {
  it("shows the staff name given by the server, and its initial, not the session login", () => {
    render(<AdminSidebar onOpenPos={() => {}} staffName="Tài Chí Tuyền" />);
    expect(screen.getByText("Tài Chí Tuyền")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.queryByText("tuyen2612")).toBeNull();
  });

  it("falls back to the session name when no staff name is given", () => {
    render(<AdminSidebar onOpenPos={() => {}} />);
    expect(screen.getByText("tuyen2612")).toBeInTheDocument();
  });
});

describe("AdminSidebar responsive collapsed state", () => {
  it("starts collapsed below 1024px when nothing is stored", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      q => ({ matches: q === "(max-width: 1023px)" }) as unknown as MediaQueryList,
    );

    const { container } = render(<AdminSidebar onOpenPos={() => {}} />);
    expect(screen.getByRole("button", { name: "Mở rộng menu" })).toBeInTheDocument();
    expect(container.querySelector("aside")).toHaveClass("w-[76px]");
  });

  it("opens on tapping a group icon without saving to localStorage", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      q => ({ matches: q === "(max-width: 1023px)" }) as unknown as MediaQueryList,
    );

    const { container } = render(<AdminSidebar onOpenPos={() => {}} />);
    expect(container.querySelector("aside")).toHaveClass("w-[76px]");

    fireEvent.click(screen.getByRole("button", { name: "Bán hàng" }));

    expect(container.querySelector("aside")).toHaveClass("w-[272px]");
    expect(localStorage.getItem("fnb.sidebarCollapsed")).toBeNull();
  });
});
