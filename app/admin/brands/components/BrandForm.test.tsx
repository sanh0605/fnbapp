// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { BrandForm } from "./BrandForm";
import type { DBBrand } from "@/types/db";

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
  addBrand: vi.fn(),
  editBrand: vi.fn(),
  deleteBrand: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/brands",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("@/app/admin/brands/actions", () => ({
  addBrand: mocks.addBrand,
  editBrand: mocks.editBrand,
  deleteBrand: mocks.deleteBrand,
}));

function brandFixture(overrides: Partial<DBBrand> = {}): DBBrand {
  return {
    id: "BR-001",
    name: "Phin Đi",
    code: "PHD",
    start_date: "2026-01-01",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
  mocks.addBrand.mockReset();
  mocks.editBrand.mockReset();
  mocks.deleteBrand.mockReset();
});

describe("BrandForm", () => {
  it("renders on the page and immediately shows the brand name input and Bỏ button", () => {
    render(<BrandForm returnTo="/admin/brands" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Tên Thương Hiệu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("pre-fills fields when editing", () => {
    render(
      <BrandForm
        initialData={brandFixture({ name: "Uchako", code: "UCK" })}
        returnTo="/admin/brands"
      />
    );
    expect(screen.getByLabelText("Tên Thương Hiệu")).toHaveValue("Uchako");
    expect(screen.getByLabelText("Mã Đơn Hàng (3 ký tự)")).toHaveValue("UCK");
  });

  it("after a successful add, goes to returnTo and refreshes", async () => {
    mocks.addBrand.mockResolvedValue({});
    render(<BrandForm returnTo="/admin/brands" />);
    fireEvent.change(screen.getByLabelText("Tên Thương Hiệu"), { target: { value: "Trà Sữa Mới" } });
    fireEvent.change(screen.getByLabelText("Mã Đơn Hàng (3 ký tự)"), { target: { value: "TSM" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu Thương Hiệu" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/brands"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on page, shows red alert, keeps typed name", async () => {
    mocks.addBrand.mockResolvedValue({ error: "Ten thuong hieu da ton tai" });
    render(<BrandForm returnTo="/admin/brands" />);
    fireEvent.change(screen.getByLabelText("Tên Thương Hiệu"), { target: { value: "Phin Đi" } });
    fireEvent.change(screen.getByLabelText("Mã Đơn Hàng (3 ký tự)"), { target: { value: "PHD" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu Thương Hiệu" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ten thuong hieu da ton tai"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tên Thương Hiệu")).toHaveValue("Phin Đi");
  });

  it("Bỏ goes to returnTo without calling server action", () => {
    render(<BrandForm returnTo="/admin/brands" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/brands");
    expect(mocks.addBrand).not.toHaveBeenCalled();
  });

  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z and preserves start_date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      mocks.editBrand.mockResolvedValue({});
      render(
        <BrandForm
          initialData={brandFixture({ start_date: "2026-09-15" })}
          returnTo="/admin/brands"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
      await waitFor(() => expect(mocks.editBrand).toHaveBeenCalledTimes(1));
      const formData = mocks.editBrand.mock.calls[0][0] as FormData;
      expect(formData.get("start_date")).toBe("2026-09-15");
    } finally {
      vi.useRealTimers();
    }
  });
});
