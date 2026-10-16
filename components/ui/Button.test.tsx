// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

// Spec 2.1: Chính (primary), Phụ (secondary), Xoá (delete), Xác nhận xoá (danger).
describe("BR-UI-005 Button", () => {
  it("draws a link that looks like the button when given href (the Tạo button on a list)", () => {
    render(<Button href="/admin/suppliers/new">Tạo nhà cung cấp</Button>);
    const link = screen.getByRole("link", { name: "Tạo nhà cung cấp" });
    expect(link.getAttribute("href")).toBe("/admin/suppliers/new");
    expect(link.className).toContain("bg-primary");
    expect(link.className).toContain("min-h-[48px]");
  });

  it.each(["primary", "secondary", "delete", "danger"] as const)("%s is 48px tall", variant => {
    render(<Button variant={variant}>Bấm</Button>);
    expect(screen.getByRole("button", { name: "Bấm" }).className).toContain("min-h-[48px]");
  });

  it("Phụ is white with a thin border, not the grey that looks switched off", () => {
    render(<Button variant="secondary">Lọc</Button>);
    const cls = screen.getByRole("button", { name: "Lọc" }).className;
    expect(cls).toContain("bg-surface-card");
    expect(cls).toContain("border-border");
    expect(cls).not.toContain("bg-surface-secondary");
  });

  it("Xoá is a red outline, not solid red", () => {
    render(<Button variant="delete">Huỷ phiếu</Button>);
    const cls = screen.getByRole("button", { name: "Huỷ phiếu" }).className.split(/\s+/);
    expect(cls).toContain("text-danger");
    expect(cls).toContain("border-danger");
    expect(cls).not.toContain("bg-danger");
  });

  it("Xác nhận xoá is solid red", () => {
    render(<Button variant="danger">Xoá</Button>);
    expect(screen.getByRole("button", { name: "Xoá" }).className.split(/\s+/)).toContain("bg-danger");
  });

  it("is switched off while loading", () => {
    render(<Button loading>Lưu</Button>);
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  // Owner 2026-10-14: while a save runs the button turns into two arrows going round.
  it("while loading shows only the two turning arrows in place of its words, and keeps its name", () => {
    render(<Button loading>Tạo</Button>);
    const button = screen.getByRole("button", { name: "Tạo" });
    const icon = button.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("lucide-refresh-cw");
    expect(icon?.getAttribute("class")).toContain("animate-spin");
    expect(button.querySelector("svg.lucide-loader-circle, svg.lucide-loader-2")).toBeNull();
    const words = screen.getByText("Tạo");
    expect(words.className).toContain("invisible");
  });

  it("shows no arrows when not loading", () => {
    render(<Button>Tạo</Button>);
    expect(screen.getByRole("button", { name: "Tạo" }).querySelector("svg")).toBeNull();
  });
});

describe("Button height by device (owner 2026-10-11 trial)", () => {
  it.each(["primary", "secondary", "delete", "danger"] as const)("%s is 48px on a phone and 40px on a computer", variant => {
    render(<Button variant={variant}>Bấm</Button>);
    const cls = screen.getByRole("button", { name: "Bấm" }).className;
    expect(cls).toContain("min-h-[48px]");
    expect(cls).toContain("md:min-h-[40px]");
  });
});
