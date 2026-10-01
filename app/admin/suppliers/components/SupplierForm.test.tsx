// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SupplierForm } from "./SupplierForm";
import type { DBSupplier } from "@/types/db";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const { replace, refresh, back, push, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    searchParams: new URLSearchParams(),
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

const mocks = vi.hoisted(() => ({
  addSupplier: vi.fn(),
  editSupplier: vi.fn(),
  deleteSupplierAction: vi.fn(),
  confirm: vi.fn(),
  alert: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/suppliers",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("../actions", () => ({
  addSupplier: mocks.addSupplier,
  editSupplier: mocks.editSupplier,
  deleteSupplierAction: mocks.deleteSupplierAction,
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: mocks.confirm,
  alert: mocks.alert,
}));

function supplier(overrides: Partial<DBSupplier> = {}): DBSupplier {
  return {
    id: "SUP-001",
    name: "Nhà cung cấp mẫu",
    phone: "",
    tax_id: "",
    address: "",
    links: "",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
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
  mocks.addSupplier.mockReset();
  mocks.editSupplier.mockReset();
  mocks.deleteSupplierAction.mockReset();
  mocks.confirm.mockReset();
  mocks.alert.mockReset();
});

describe("SupplierForm", () => {
  it("renders the fields on the page, not in a dialog", () => {
    render(<SupplierForm returnTo="/admin/suppliers" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toBeInTheDocument();
  });

  it("prefills every field when editing", () => {
    render(
      <SupplierForm
        returnTo="/admin/suppliers"
        initialData={supplier({ name: "Cửa hàng ABC", phone: "0901234567" })}
      />
    );
    expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toHaveValue("Cửa hàng ABC");
    expect(screen.getByLabelText("Số Điện Thoại")).toHaveValue("0901234567");
  });

  it("after a successful add, goes to returnTo and refreshes", async () => {
    mocks.addSupplier.mockResolvedValue({});
    render(<SupplierForm returnTo="/admin/suppliers?q=ABC" />);
    fireEvent.change(screen.getByLabelText("Tên Nhà Cung Cấp"), { target: { value: "Cửa hàng ABC" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/suppliers?q=ABC"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on the page, shows the message, keeps the typed name", async () => {
    mocks.addSupplier.mockResolvedValue({ error: "Tên đã tồn tại" });
    render(<SupplierForm returnTo="/admin/suppliers" />);
    fireEvent.change(screen.getByLabelText("Tên Nhà Cung Cấp"), { target: { value: "Cửa hàng ABC" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tên đã tồn tại"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toHaveValue("Cửa hàng ABC");
  });

  it("declining the near-duplicate question stays on the page and does not save twice", async () => {
    mocks.addSupplier.mockResolvedValue({ needsDuplicateWarning: { message: "Gần giống ABC" } });
    mocks.confirm.mockResolvedValue(false);
    render(<SupplierForm returnTo="/admin/suppliers" />);
    fireEvent.change(screen.getByLabelText("Tên Nhà Cung Cấp"), { target: { value: "Cửa hàng ABD" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.addSupplier).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("Bỏ goes to returnTo without saving", () => {
    render(<SupplierForm returnTo="/admin/suppliers?status=INACTIVE" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/suppliers?status=INACTIVE");
    expect(mocks.addSupplier).not.toHaveBeenCalled();
  });

  it("supports returnMode='po' with initialName, appending newSupplier on save and returning to PO on Bỏ", async () => {
    mocks.addSupplier.mockResolvedValue({ success: true, id: "SUP-9" });
    const { unmount } = render(
      <SupplierForm
        returnTo="/admin/inventory/purchase-orders/new?draft=1"
        returnMode="po"
        initialName="Đại Phát"
      />
    );
    expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toHaveValue("Đại Phát");
    fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/admin/inventory/purchase-orders/new?draft=1&newSupplier=SUP-9"
      );
    });
    expect(refresh).toHaveBeenCalled();

    unmount();
    render(
      <SupplierForm
        returnTo="/admin/inventory/purchase-orders/new?draft=1"
        returnMode="po"
        initialName="Đại Phát"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/purchase-orders/new?draft=1");
  });
});

