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

// The start and end boxes are SaigonDateTimeInput (react-datepicker), whose
// mount effect calls window.matchMedia, which jsdom does not implement.
// Same stub as app/admin/products/components/ProductForm.test.tsx.
if (typeof window.matchMedia !== "function") {
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
    expect(screen.getByLabelText("Mã khuyến mãi (để nhập tay)")).toHaveValue("SUMMER");
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

  it("edit of start_date 2026-09-14T23:30:00Z shows 15/09/2026 06:30; saving sends 2026-09-14T23:30:00.000Z", async () => {
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

      const startInput = screen.getByLabelText("Bắt đầu lúc *") as HTMLInputElement;
      // 24-hour Saigon box (dd/MM/yyyy HH:mm), not the browser's 12-hour datetime-local.
      expect(startInput.value).toBe("15/09/2026 06:30");

      fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
      await waitFor(() => expect(mocks.savePromotion).toHaveBeenCalledTimes(1));
      const payload = mocks.savePromotion.mock.calls[0][0];
      expect(payload.start_date).toBe("2026-09-14T23:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders status options in Vietnamese only (no English)", () => {
    render(
      <PromotionForm
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions"
      />
    );
    expect(screen.getByRole("option", { name: "Hoạt động" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Không hoạt động" })).toBeInTheDocument();
    expect(screen.queryByText(/ACTIVE/)).toBeNull();
    expect(screen.queryByText(/INACTIVE/)).toBeNull();
  });
});

// Wave K4 (BR-UI-008, BR-CASH-005, BR-UI-009): the value boxes are the shared
// number box; a percentage stops at 100 on the page, as the server already does.
describe("PromotionForm -- value boxes (wave K4)", () => {
  const renderPromo = (overrides: Partial<DBPromotion> = {}) =>
    render(
      <PromotionForm
        initialData={promoFixture(overrides)}
        brands={mockBrands}
        categories={mockCategories}
        products={mockProducts}
        variants={mockVariants}
        returnTo="/admin/promotions"
      />,
    );
  const valueBox = () => screen.getByLabelText("Giá trị giảm giá *") as HTMLInputElement;
  const minBox = () => screen.getByLabelText("Đơn tối thiểu để áp dụng") as HTMLInputElement;

  it("switching a 15,000đ value to Phần trăm says the limit at once (Review Focus 3)", () => {
    renderPromo({ discount_type: "FLAT_VND", discount_value: "15000" });
    expect(screen.queryByText("Nhập số không quá 100.")).toBeNull();
    fireEvent.change(screen.getByLabelText("Hình thức giảm giá"), { target: { value: "PERCENT" } });
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
  });

  it("a percentage has % inside and refuses 150 under the box", () => {
    renderPromo();
    const box = valueBox();
    expect(box.type).toBe("text");
    expect(box.getAttribute("inputmode")).toBe("numeric");
    expect(box.value).toBe("10");
    expect(box.parentElement?.textContent).toContain("%");
    fireEvent.change(box, { target: { value: "150" } });
    fireEvent.blur(box);
    expect(screen.getByText("Nhập số không quá 100.")).toBeInTheDocument();
  });

  it("a fixed amount has đ inside, groups thousands, and saves the number", async () => {
    mocks.savePromotion.mockResolvedValue({ success: true, data: { id: "PRM-001" } });
    renderPromo({ discount_type: "FLAT_VND", discount_value: "10000" });
    const box = valueBox();
    expect(box.value).toBe("10,000");
    expect(box.parentElement?.textContent).toContain("đ");
    fireEvent.change(box, { target: { value: "20000" } });
    expect(box.value).toBe("20,000");
    expect(minBox().value).toBe("50,000");
    fireEvent.change(minBox(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(mocks.savePromotion).toHaveBeenCalledTimes(1));
    const payload = mocks.savePromotion.mock.calls[0][0];
    expect(payload.discount_value).toBe(20000);
    expect(payload.min_order_value).toBe(0);
  });

  it("a size's own value groups thousands; left empty it takes the shared value", async () => {
    mocks.savePromotion.mockResolvedValue({ success: true, data: { id: "PRM-001" } });
    renderPromo({
      type: "PRODUCT_DISCOUNT", discount_type: "FLAT_VND", discount_value: "10000",
      applicable_products_json: JSON.stringify({ "VAR-001": 10000 }),
    } as Partial<DBPromotion>);
    const own = screen.getByLabelText("Giảm riêng: Cà phê đen M") as HTMLInputElement;
    expect(own.type).toBe("text");
    fireEvent.change(own, { target: { value: "12000" } });
    expect(own.value).toBe("12,000");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(mocks.savePromotion).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mocks.savePromotion.mock.calls[0][0].applicable_products_json)).toEqual({ "VAR-001": 12000 });

    mocks.savePromotion.mockClear();
    fireEvent.change(own, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(mocks.savePromotion).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mocks.savePromotion.mock.calls[0][0].applicable_products_json)).toEqual({ "VAR-001": 10000 });
  });
});
