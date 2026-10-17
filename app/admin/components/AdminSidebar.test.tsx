// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "./AdminSidebar";

afterEach(cleanup);

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
