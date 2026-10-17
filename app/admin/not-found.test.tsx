// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminNotFound from "./not-found";

describe("app/admin/not-found", () => {
  it("renders the heading 'Không tìm thấy trang' and a link with href '/admin'", () => {
    render(<AdminNotFound />);
    expect(screen.getByRole("heading", { name: "Không tìm thấy trang" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Về Tổng quan/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin");
  });
});
