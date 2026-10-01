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
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./SupplierForm", () => ({
  DeleteSupplierButton: () => <button>Xóa</button>,
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
        initialStatus="ALL"
      />
    );
    expect(screen.getAllByText("Cà phê Phin").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sữa Mlekovita")).toBeNull();
  });

  it("typing in search writes q to the URL with replace", () => {
    render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="" initialStatus="ALL" />);
    fireEvent.change(screen.getByPlaceholderText("Tên, SĐT, địa chỉ..."), { target: { value: "Cà phê" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/suppliers?q=C%C3%A0+ph%C3%AA", { scroll: false });
  });

  it("Thêm links to the new page carrying the current list URL", () => {
    render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="ABC" initialStatus="INACTIVE" />);
    const link = screen.getByRole("link", { name: "+ Thêm nhà cung cấp" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/suppliers/new?returnTo=" + encodeURIComponent("/admin/suppliers?q=ABC&status=INACTIVE")
    );
  });

  it("Sửa links to that supplier's edit page", () => {
    render(
      <SuppliersClient
        suppliers={[sup("SUP-001", "Cà phê Phin")]}
        canDelete={false}
        initialSearch=""
        initialStatus="ALL"
      />
    );
    const links = screen.getAllByRole("link", { name: "Sửa" });
    expect(links[0]).toHaveAttribute("href", "/admin/suppliers/SUP-001/edit?returnTo=" + encodeURIComponent("/admin/suppliers"));
  });

  it("an INACTIVE supplier still has a Sửa link", () => {
    render(
      <SuppliersClient
        suppliers={[sup("SUP-003", "Cũ", "INACTIVE")]}
        canDelete={false}
        initialSearch=""
        initialStatus="ALL"
      />
    );
    expect(screen.getAllByRole("link", { name: "Sửa" }).length).toBeGreaterThan(0);
  });
});
