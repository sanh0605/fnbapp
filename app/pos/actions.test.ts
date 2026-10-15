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
    expect(pageSource).not.toContain("outOfStockProductIds=");
    expect(pageSource).not.toContain("getSalesDataV2");
    expect(pageSource).not.toContain("getRealtimeStock");
  });
});

describe("submitOrderV2 -- a price changed while the till was open (BR-SALE-008)", () => {
  it.todo(
    "Máy bán gửi tổng tiền đang hiện; máy chủ tính lại theo giá đang áp dụng lúc nhận đơn, lệch thì từ chối và báo tải lại trang (chủ quán chốt 14/10/2026)",
  );
});

describe("submitOrderV2 -- a promotion edited after the order was taken (BR-SALE-008)", () => {
  it.todo(
    "Khuyến mãi sửa được dù đã có đơn dùng; đơn gửi trễ không khớp mức khuyến mãi hiện tại thì bị từ chối, thu ngân bấm lại (chủ quán chốt 15/10/2026)",
  );
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
      items: [line("P3", "V3")],
      manual_order_discount: { value: 5000, type: "VND" },
    }, REF);
    expect(r.order.promo_discount_total).toBe(10000);
    expect(r.order.manual_order_discount).toBe(5000);
    expect(r.order.net_total).toBe(85000);
  });
});

describe("submitOrderV2 -- minimum order value after dish discounts (BR-SALE-011)", () => {
  it.todo(
    "Đơn tối thiểu so với tổng sau giảm từng món: 4 Bạc xỉu 116.000, giảm 5.000 mỗi ly còn 96.000, khuyến mãi tối thiểu 100.000 không được áp (chủ quán chốt 15/10/2026)",
  );
});

describe("submitOrderV2 -- promotions without a code and the Dùng chung box (BR-SALE-011)", () => {
  it.todo(
    "Khuyến mãi không mã tự áp khi đủ điều kiện; hai khuyến mãi chỉ cộng khi cả hai đặt Dùng chung, không thì thu ngân chọn một; máy chủ không tự áp loại cần mã (chủ quán chốt 14/10/2026)",
  );
});
