// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PromotionForm } from "./PromotionForm";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";

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
  savePromotion: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/promotions",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("@/app/admin/promotions/actions", () => ({
  savePromotion: mocks.savePromotion,
}));

const mockBrands: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", start_date: "2026-01-01", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];
const mockCategories: DBProductCategory[] = [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE" },
];
const mockProducts: DBProduct[] = [
  { id: "PROD-001", code: "CF01", name: "Cà phê đen", category_id: "CAT-001", status: "ACTIVE" },
];
const mockVariants: DBProductVariant[] = [
  { id: "VAR-001", product_id: "PROD-001", size_name: "M", price: "25000", status: "ACTIVE" },
];

function promoFixture(overrides: Partial<DBPromotion> = {}): DBPromotion {
  return {
    id: "PRM-001",
    name: "Giảm 10%",
    code: "SALE10",
    brand_id: "BR-001",
    type: "ORDER_DISCOUNT",
    discount_type: "PERCENT",
    discount_value: "10",
    min_order_value: "50000",
    start_date: "2026-01-01T00:00:00.000Z",
    end_date: "2026-12-31T23:59:59.000Z",
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
  mocks.savePromotion.mockReset();
});

describe("PromotionForm", () => {
  it("renders on the page without onClose and shows name field and Bỏ button", () => {
    render(
      <PromotionForm
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions?status=ACTIVE"
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Tên chương trình *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("clicking Bỏ navigates to returnTo without saving", () => {
    render(
      <PromotionForm
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions?status=ACTIVE"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/promotions?status=ACTIVE");
    expect(mocks.savePromotion).not.toHaveBeenCalled();
  });

  it("pre-fills fields when editing", () => {
    render(
      <PromotionForm
        initialData={promoFixture({ name: "Khuyến mãi hè", code: "SUMMER" })}
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions"
      />
    );
    expect(screen.getByLabelText("Tên chương trình *")).toHaveValue("Khuyến mãi hè");
    expect(screen.getByLabelText("Mã Code (Để nhập thủ công)")).toHaveValue("SUMMER");
  });

  it("after a successful save, goes to returnTo and refreshes", async () => {
    mocks.savePromotion.mockResolvedValue({ success: true, data: { id: "PRM-001" } });
    render(
      <PromotionForm
        initialData={promoFixture()}
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions?status=ACTIVE"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/promotions?status=ACTIVE"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on the page, shows the error alert, retains inputs", async () => {
    mocks.savePromotion.mockResolvedValue({ success: false, error: "Mã khuyến mãi đã tồn tại" });
    render(
      <PromotionForm
        initialData={promoFixture()}
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Mã khuyến mãi đã tồn tại"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tên chương trình *")).toHaveValue("Giảm 10%");
  });

  it("edit of start_date 2026-09-14T23:30:00Z shows 2026-09-15T06:30; saving sends 2026-09-14T23:30:00.000Z", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      mocks.savePromotion.mockResolvedValue({ success: true, data: { id: "PRM-001" } });
      render(
        <PromotionForm
          initialData={promoFixture({
            start_date: "2026-09-14T23:30:00Z",
            end_date: "",
          })}
          brands={mockBrands}
          categories={mockCategories}
          products={mockProducts}
          variants={mockVariants}
          returnTo="/admin/promotions"
        />
      );

      const startInput = screen.getByLabelText("Ngày/Giờ bắt đầu *") as HTMLInputElement;
      expect(startInput.value).toBe("2026-09-15T06:30");

      fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
      await waitFor(() => expect(mocks.savePromotion).toHaveBeenCalledTimes(1));
      const payload = mocks.savePromotion.mock.calls[0][0];
      expect(payload.start_date).toBe("2026-09-14T23:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});
