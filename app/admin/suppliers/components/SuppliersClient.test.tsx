// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SuppliersClient from "./SuppliersClient";
import type { DBSupplier } from "@/types/db";

const { replace, refresh, back, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({
  deleteSupplierAction: vi.fn(),
}));

function sup(id: string, name: string, status: string = "ACTIVE"): DBSupplier {
  return {
    id,
    name,
    phone: "",
    tax_id: "",
    address: "",
    links: "",
    status,
    created_at: "2026-01-01T00:00:00Z",
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
});

describe("SuppliersClient", () => {
  it("starts from the filters in the URL", () => {
    render(
      <SuppliersClient
        suppliers={[sup("SUP-001", "Cà phê Phin"), sup("SUP-002", "Sữa Mlekovita")]}
        canDelete={false}
        initialSearch="Cà phê"
      />
    );
    expect(screen.getAllByText("Cà phê Phin").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sữa Mlekovita")).toBeNull();
  });

  it("typing in search writes q to the URL with replace", () => {
    render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="" />);
    fireEvent.change(screen.getByPlaceholderText("Tên, SĐT, địa chỉ..."), { target: { value: "Cà phê" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/suppliers?q=C%C3%A0+ph%C3%AA", { scroll: false });
  });

  it("Thêm links to the new page carrying the current list URL", () => {
    render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="ABC" />);
    const link = screen.getByRole("link", { name: "Tạo" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/suppliers/new?returnTo=" + encodeURIComponent("/admin/suppliers?q=ABC")
    );
  });

  it("links to that supplier's detail page instead of a removed Sửa button", () => {
    // Sửa button was removed from list rows; clicking row now links to the detail page
    render(
      <SuppliersClient
        suppliers={[sup("SUP-001", "Cà phê Phin")]}
        canDelete={false}
        initialSearch=""
      />
    );
    const links = screen.getAllByRole("link", { name: /Cà phê Phin/ });
    expect(
      links.some(
        (l) =>
          l.getAttribute("href") ===
          "/admin/suppliers/SUP-001?returnTo=" + encodeURIComponent("/admin/suppliers")
      )
    ).toBe(true);
  });

  it("an INACTIVE supplier links to detail page and displays inactive badge", () => {
    // Sửa button was removed; row links to detail and shows 'Ngừng hợp tác'
    render(
      <SuppliersClient
        suppliers={[sup("SUP-003", "Cũ", "INACTIVE")]}
        canDelete={false}
        initialSearch=""
      />
    );
    const links = screen.getAllByRole("link", { name: /Cũ/ });
    expect(links.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ngừng hợp tác").length).toBeGreaterThan(0);
  });

  it("does not render a status select filter", () => {
    render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="" />);
    expect(screen.queryByText("Trạng thái")).toBeNull();
  });

  it("initialSearch='vina' links Vinamilk row to its detail page carrying returnTo", () => {
    render(
      <SuppliersClient
        suppliers={[sup("NCC-029", "Vinamilk")]}
        canDelete={false}
        initialSearch="vina"
      />
    );
    const vinamilkLinks = screen.getAllByRole("link", { name: /Vinamilk/ });
    expect(
      vinamilkLinks.some(
        (l) =>
          l.getAttribute("href") ===
          "/admin/suppliers/NCC-029?returnTo=" + encodeURIComponent("/admin/suppliers?q=vina")
      )
    ).toBe(true);
  });

  it("does not render Sửa or Xem đơn nhập in list rows", () => {
    render(
      <SuppliersClient
        suppliers={[sup("NCC-029", "Vinamilk")]}
        canDelete={true}
        initialSearch=""
      />
    );
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Xem đơn nhập" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();
    expect(screen.queryByText("Xem đơn nhập")).toBeNull();
  });

  it("canDelete=false renders no checkboxes", () => {
    render(
      <SuppliersClient
        suppliers={[sup("NCC-029", "Vinamilk")]}
        canDelete={false}
        initialSearch=""
      />
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("46 suppliers with initialPage='3' shows '41–46 trên 46'", () => {
    const fortySixSuppliers: DBSupplier[] = Array.from({ length: 46 }, (_, i) =>
      sup(`NCC-${String(i + 1).padStart(3, "0")}`, `Nhà cung cấp ${i + 1}`)
    );
    render(
      <SuppliersClient
        suppliers={fortySixSuppliers}
        canDelete={false}
        initialSearch=""
        initialPage="3"
      />
    );
    // The footer splits the numbers into bold spans, so match the whole line.
    expect(screen.getByText((_, el) => el?.textContent === "41–46 trên 46 nhà cung cấp")).toBeInTheDocument();
  });
});
