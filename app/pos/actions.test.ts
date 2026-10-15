import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOrderFromCart } from "@/lib/sales/order-cart";
import type { ReferenceData } from "@/lib/sales/order-cart";

describe("POS order COGS calculation", () => {
  // Plan C Task 3: checkout no longer computes a cost or moves stock. The
  // two tests that used to live here asserted the removed machinery was
  // present (getPosInventoryState, computeMacCostFromUnitCosts,
  // buildStockLedgerEntries, the implicit-production split) -- replaced with
  // the opposite assertion rather than deleted silently, since "checkout
  // stops doing the work" is exactly the regression worth locking in now.
  //
  // Phase C
  // (8/8, POS): this test used to assert `ledgerRows: []` was still being
  // sent -- Phase C removed create_pos_order_atomic's stock_ledger write
  // entirely, so there is no longer a ledgerRows field to send at all.
  it("computes no cost and writes no ledger row -- one atomic write with no ledger field", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const submitOrderSource = source.slice(
      source.indexOf("export async function submitOrderV2"),
      source.indexOf("export async function getPOSBestSellerProductIds"),
    );

    expect(source).not.toContain("getPosInventoryState");
    expect(source).not.toContain("computeMacCostFromUnitCosts");
    expect(source).not.toContain("buildStockLedgerEntries");
    expect(source).not.toContain("splitImplicitProduction");
    expect(source).toContain("savePosOrderAtomic");
    expect(submitOrderSource).not.toContain("ledgerRows");
    expect(submitOrderSource).not.toContain('findAllNoCache("Stock_Ledger")');
    expect(submitOrderSource).not.toContain("assignOrderNo");
    expect(submitOrderSource).not.toContain("ensureUniqueOrderNo");
    expect(submitOrderSource).not.toContain("insertOrderV2Records");
    expect(submitOrderSource).not.toContain("FIFOTracker");
    expect(submitOrderSource).toContain("requestToken?: string");
    expect(submitOrderSource).toContain("clientRequestId: requestToken");
  });

  it("reuses a checkout token until the same payload succeeds", () => {
    const screenSource = readFileSync(
      resolve(process.cwd(), "app/pos/components/POSScreen.tsx"),
      "utf8",
    );

    expect(screenSource).toContain("resolvePosCheckoutAttempt");
    expect(screenSource).toContain("checkoutAttemptRef");
    expect(screenSource).toMatch(
      /submitOrderV2\(\s*cartInput,\s*checkoutAttempt\.requestToken,?\s*\)/,
    );
    expect(screenSource).toContain("checkoutAttemptRef.current = null");
  });

  it("scopes the best-seller order-lines fetch to the requested date range instead of the whole table", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const bestSellerSource = source.slice(
      source.indexOf("export async function getPOSBestSellerProductIds"),
      source.indexOf("export async function getPOSDrafts"),
    );

    // Regression: this used to call findAllNoCache("Order_Lines_V2")
    // unconditionally -- an uncached full-table fetch (2,300+ rows and
    // growing, measured at 1.5s+ alone) on every POS page load, made worse
    // by revalidatePath("/pos") forcing this to run fresh after every
    // checkout. Must be date-scoped via findAllWhere whenever a date range
    // is available (the only real caller, app/pos/page.tsx, always passes
    // one).
    expect(bestSellerSource).toContain('findAllWhere("Order_Lines_V2"');
    expect(bestSellerSource).toMatch(
      /dateRange\s*\?\s*findAllWhere\("Order_Lines_V2"/,
    );
  });

  // Phase A:
  // getPOSStockStatus is gone from the module entirely now (owner decision
  // 2026-08-31, see app/pos/actions.auth.test.ts's "no longer exports"
  // proof), not merely uncalled -- the not.toContain check below is on the
  // CALL shape, not the bare name, since the page's own comment names the
  // deleted function on purpose, explaining why it is gone.
  it("does not fetch stock or recipes -- the out-of-stock feature stays disabled, and its data function is gone", () => {
    const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

    expect(pageSource).toContain("getPOSBestSellerProductIds");
    expect(pageSource).not.toContain("getPOSStockStatus()");
    expect(pageSource).not.toContain('findAll("Recipes")');
    expect(pageSource).not.toContain("pickVariantRecipe");
    expect(pageSource).not.toContain("getSalesDataV2");
    expect(pageSource).not.toContain("getRealtimeStock");
  });
});

const REF: ReferenceData = {
  brands: [{ id: "BR-002" }],
  products: [
    { id: "P1", name: "Bạc xỉu", category_id: "C", status: "ACTIVE" },
    { id: "P2", name: "Cà phê sữa", category_id: "C", status: "ACTIVE" },
    { id: "P3", name: "Trà lớn", category_id: "C", status: "ACTIVE" },
  ],
  variants: [
    { id: "V1", product_id: "P1", size_name: "M", price: "29000", status: "ACTIVE" },
    { id: "V2", product_id: "P2", size_name: "M", price: "25000", status: "ACTIVE" },
    { id: "V3", product_id: "P3", size_name: "L", price: "100000", status: "ACTIVE" },
  ],
  categories: [{ id: "C", name: "Đồ uống" }],
  modifiers: [],
  promotions: [{
    id: "ORD-10", name: "Giảm 10% hóa đơn", type: "ORDER_DISCOUNT", discount_type: "PERCENT", discount_value: "10",
    applicable_products_json: "", code: "", start_date: "2026-01-01T00:00:00.000Z", end_date: "", status: "ACTIVE", brand_id: "", min_order_value: "0",
  }],
};
const line = (product_id: string, variant_id: string, discount = 0) => ({
  product_id, variant_id, qty: 1, modifiers: [], manual_item_discount: { value: discount, type: "VND" as const },
});
const base = { brand_id: "BR-002", outlet_id: "OUT-002", payment_method: "CASH" as const, actor: { id: "U1", name: "Test" } };

describe("submitOrderV2 -- percent order discount base (BR-SALE-009)", () => {
  it("Giảm % cả đơn tính trên tổng sau giảm từng món: Bạc xỉu 29.000 giảm 4.000 + Cà phê sữa 25.000, giảm 10% cả đơn = 45.000", () => {
    const r = buildOrderFromCart({
      ...base,
      items: [line("P1", "V1", 4000), line("P2", "V2")],
      manual_order_discount: { value: 10, type: "PERCENT" },
    }, { ...REF, promotions: [] });
    expect(r.order.manual_order_discount).toBe(5000);
    expect(r.order.net_total).toBe(45000);
  });
});

describe("submitOrderV2 -- whole-order promotion stacks with the cashier discount (BR-SALE-010)", () => {
  it("Giảm 10% hóa đơn trên 100.000 rồi giảm tay 5.000 = 85.000", () => {
    const r = buildOrderFromCart({
      ...base,
      items: [line("P3", "V3")], promotion_ids: ["ORD-10"],
      manual_order_discount: { value: 5000, type: "VND" },
    }, REF);
    expect(r.order.promo_discount_total).toBe(10000);
    expect(r.order.manual_order_discount).toBe(5000);
    expect(r.order.net_total).toBe(85000);
  });
});

// Row shape of the promotions table as the server reads it.
const promoRow = (p: Record<string, unknown>) => ({
  id: "P", name: "KM", type: "PRODUCT_DISCOUNT", discount_type: "FLAT_VND", discount_value: "0",
  applicable_products_json: "", code: "", start_date: "2026-01-01T00:00:00.000Z", end_date: "", status: "ACTIVE",
  brand_id: "", min_order_value: "0", stackable: false, ...p,
});
const REFUSED = "Giá hoặc khuyến mãi đã thay đổi. Tải lại trang rồi bấm lại.";

describe("submitOrderV2 -- a price changed while the till was open (BR-SALE-008)", () => {
  const order = (shown_total: number, extra: Record<string, unknown> = {}) =>
    () => buildOrderFromCart({ ...base, items: [line("P1", "V1")], promotion_ids: [], shown_total, ...extra }, { ...REF, promotions: [] });

  it("Máy bán hiện 29.000 nhưng giá đã đổi thành 32.000: máy chủ từ chối và báo tải lại trang", () => {
    const changed = { ...REF, promotions: [], variants: REF.variants.map(v => v.id === "V1" ? { ...v, price: "32000" } : v) };
    const call = () => buildOrderFromCart({ ...base, items: [line("P1", "V1")], promotion_ids: [], shown_total: 29000 }, changed);
    expect(call).toThrow(REFUSED);
  });

  it("tổng máy bán hiện khớp thì nhận đơn", () => {
    expect(order(29000)().order.net_total).toBe(29000);
  });

  it("đơn gửi trễ lấy giá lúc bấm thanh toán từ lịch sử giá: 7h giá 29.000, trưa đổi 32.000, đơn 7h vẫn 29.000", () => {
    const ref = {
      ...REF, promotions: [],
      variants: REF.variants.map(v => v.id === "V1" ? { ...v, price: "32000" } : v),
      priceHistory: [{ variant_id: "V1", old_price: 29000, new_price: 32000, effective_at: new Date(Date.now() - 60 * 60_000).toISOString() }],
    };
    const at = (client_captured_at: string, shown_total: number) =>
      buildOrderFromCart({ ...base, items: [line("P1", "V1")], promotion_ids: [], shown_total, client_captured_at }, ref).order.net_total;
    expect(at(new Date(Date.now() - 1 * 60_000).toISOString(), 32000)).toBe(32000);
    expect(at(new Date(Date.now() - 120 * 60_000).toISOString(), 29000)).toBe(29000);
  });
});

describe("submitOrderV2 -- a promotion edited after the order was taken (BR-SALE-008)", () => {
  it("Khuyến mãi 10% hóa đơn sửa thành 5%: máy bán còn hiện 90.000, máy chủ tính 95.000 nên từ chối", () => {
    const edited = { ...REF, promotions: [{ ...REF.promotions[0], discount_value: "5" }] };
    const call = () => buildOrderFromCart({ ...base, items: [line("P3", "V3")], promotion_ids: ["ORD-10"], shown_total: 90000 }, edited);
    expect(call).toThrow(REFUSED);
    expect(buildOrderFromCart({ ...base, items: [line("P3", "V3")], promotion_ids: ["ORD-10"], shown_total: 95000 }, edited).order.net_total).toBe(95000);
  });
});

describe("submitOrderV2 -- minimum order value after dish discounts (BR-SALE-011)", () => {
  it("Đơn tối thiểu so với tổng sau giảm từng món: 4 Bạc xỉu 116.000, giảm 5.000 mỗi ly còn 96.000, khuyến mãi tối thiểu 100.000 không được áp", () => {
    const promotions = [
      promoRow({ id: "DISH", type: "PRODUCT_DISCOUNT", discount_value: "5000", applicable_products_json: '["V1"]', stackable: true }),
      promoRow({ id: "BIG", type: "ORDER_DISCOUNT", discount_type: "FLAT_VND", discount_value: "10000", min_order_value: "100000", stackable: true }),
    ];
    const r = buildOrderFromCart({
      ...base, items: [{ ...line("P1", "V1"), qty: 4 }], promotion_ids: ["DISH", "BIG"], shown_total: 96000,
    }, { ...REF, promotions });
    expect(r.order.net_total).toBe(96000);
    expect(r.orderPromotions.map(p => [p.promotion_id, p.amount])).toEqual([["DISH", 20000]]);
  });
});

describe("submitOrderV2 -- promotions without a code and the Dùng chung box (BR-SALE-011)", () => {
  const dish = (id: string, value: string, stackable: boolean, code = "") =>
    promoRow({ id, name: id, discount_value: value, applicable_products_json: '["V1","V2"]', stackable, code });
  const cart = [line("P1", "V1"), line("P2", "V2")]; // 29.000 + 25.000
  const send = (promotions: any[], promotion_ids: string[], shown_total: number, promo_code?: string) =>
    () => buildOrderFromCart({ ...base, items: cart, promotion_ids, shown_total, promo_code }, { ...REF, promotions });

  it("hai khuyến mãi cùng Dùng chung cộng lại: 54.000 - 10.000 - 4.000 = 40.000, hai dòng order_promotions", () => {
    const promotions = [dish("A", "5000", true), dish("B", "2000", true)];
    const r = send(promotions, ["A", "B"], 40000)();
    expect(r.order.net_total).toBe(40000);
    expect(r.orderPromotions.map(p => p.seq)).toEqual([1, 2]);
    expect(r.order.applied_promotion_id).toBe("A");
  });

  it("một bên không Dùng chung: gửi cả hai thì từ chối, gửi một bộ thì nhận", () => {
    const promotions = [dish("A", "5000", true), dish("B", "2000", false)];
    expect(send(promotions, ["A", "B"], 40000)).toThrow(REFUSED);
    expect(send(promotions, ["A"], 44000)().order.net_total).toBe(44000);
  });

  it("bỏ sót khuyến mãi không mã đủ điều kiện thì từ chối", () => {
    expect(send([dish("A", "5000", false)], [], 54000)).toThrow(REFUSED);
  });

  it("khuyến mãi cần mã: không mã thì máy chủ không tự áp, gửi id mà thiếu mã thì từ chối, đủ mã thì nhận", () => {
    const promotions = [dish("C", "5000", false, "KHAI")];
    expect(send(promotions, [], 54000)().order.net_total).toBe(54000);
    expect(send(promotions, ["C"], 44000)).toThrow(REFUSED);
    expect(send(promotions, ["C"], 44000, "khai")().order.net_total).toBe(44000);
  });

  it("mã gõ sai hoặc hết hiệu lực mà máy bán gửi danh sách rỗng: máy chủ không tự chọn khuyến mãi khác", () => {
    const promotions = [dish("A", "5000", false)];
    expect(send(promotions, [], 54000, "SAI")).toThrow(REFUSED);
  });
});
