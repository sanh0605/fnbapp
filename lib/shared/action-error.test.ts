import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeActionError } from "./action-error";

describe("describeActionError", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("replaces a raw ASCII exception with the generic Vietnamese sentence, keeping the raw text as errorDetail", () => {
    // The owner's own real case: components/... no -- app/admin/inventory/
    // purchase-orders' downstream findAll(Item_Categories) call, section 1
    // of the plan.
    const result = describeActionError(new Error("findAll(Item_Categories): JWT issued at future"));

    expect(result.error).not.toContain("JWT");
    expect(result.error).not.toContain("Item_Categories");
    expect(result.error).toMatch(/Có lỗi xảy ra/);
    expect(result.errorDetail).toBe("findAll(Item_Categories): JWT issued at future");
  });

  it("logs the raw error server-side when it genericizes the message -- nothing is lost", () => {
    const original = new Error("Could not find the table 'public.purchase_order_edits'");
    describeActionError(original);

    expect(consoleErrorSpy).toHaveBeenCalledWith("[ActionError]", original);
  });

  it("passes a message with Vietnamese diacritics through unchanged -- it was already written for the owner", () => {
    const result = describeActionError(new Error("Tên này đã có rồi: \"Cà phê sữa\" (mã ING-033)."));

    expect(result.error).toBe('Tên này đã có rồi: "Cà phê sữa" (mã ING-033).');
    expect(result.errorDetail).toBeUndefined();
  });

  it("does not log server-side when the message already passes through -- it explains itself", () => {
    describeActionError(new Error("Vui lòng chọn nguồn nhập hàng"));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // Real fixtures from RPC guard refusals this codebase already relies on
  // relaying verbatim (existing tests pin these; this file's own change
  // must not be the thing that breaks them).
  it.each([
    ["create_issue_slip_atomic (I4/I5/I10)", "create_issue_slip_atomic: Dòng 2 (Dâu sấy): yêu cầu xuất 5000 g, chỉ còn 3600 g tính tới thời điểm ..."],
    ["reverse_manual_issue_atomic", "reverse_manual_issue_atomic: Phiếu ISS-00001 đã được đảo bởi ISS-00002 trước đó, không đảo hai lần"],
    ["cancel_issue_slip_atomic (U11)", "cancel_issue_slip_atomic: Phiếu ISL-00003 không còn dòng nào để huỷ -- có thể đã được đảo toàn bộ trước đó"],
    ["reverse_stocktake_session_atomic (U2-U4, post-0063 wording)", "Đang có một phiên kiểm kê đang mở -- xử lý xong phiên đó trước khi huỷ phiên đã áp dụng"],
    ["reverse_stocktake_session_atomic (0111 below-zero refusal)", "reverse_stocktake_session_atomic: Không huỷ được phiên kiểm kê STK-001: Trứng gà sẽ âm kho (còn -19 quả) vì số hàng tìm thấy lúc kiểm đã được xuất hoặc dùng. Xử lý phần đã xuất trước."],
  ])("relays %s's own refusal verbatim", (_label, message) => {
    const result = describeActionError(new Error(message));
    expect(result.error).toBe(message);
  });

  it("handles a non-Error thrown value the same way, via String(error)", () => {
    // eslint-disable-next-line no-throw-literal -- exercising a caller that threw a bare string
    const result = describeActionError("some raw string, not an Error instance");
    expect(result.error).toMatch(/Có lỗi xảy ra/);
    expect(result.errorDetail).toBe("some raw string, not an Error instance");
  });
});

// Migration 0132 constraints: the database refuses in English, the owner reads Vietnamese.
describe("describeActionError: 0132 constraint refusals", () => {
  const refusals: [string, string][] = [
    ["uom_conversions_rate_positive", 'new row for relation "uom_conversions" violates check constraint "uom_conversions_rate_positive"'],
    ["purchase_order_lines_money_not_negative", 'new row for relation "purchase_order_lines" violates check constraint "purchase_order_lines_money_not_negative"'],
    ["stock_issues_session_matches_source", 'new row for relation "stock_issues" violates check constraint "stock_issues_session_matches_source"'],
    ["stock_issues_manual_one_link", 'new row for relation "stock_issues" violates check constraint "stock_issues_manual_one_link"'],
    ["ux_stock_issues_reverses", 'duplicate key value violates unique constraint "ux_stock_issues_reverses"'],
    ["assets_quantity_positive", 'new row for relation "assets" violates check constraint "assets_quantity_positive"'],
    ["assets_term_positive", 'new row for relation "assets" violates check constraint "assets_term_positive"'],
    ["assets_costs_not_negative", 'new row for relation "assets" violates check constraint "assets_costs_not_negative"'],
    ["asset_depreciation_bands_min_unique", 'duplicate key value violates unique constraint "asset_depreciation_bands_min_unique"'],
    ["asset_depreciation_bands_min_not_negative", 'new row for relation "asset_depreciation_bands" violates check constraint "asset_depreciation_bands_min_not_negative"'],
    ["products.category_id", 'null value in column "category_id" of relation "products" violates not-null constraint'],
    ["ux_product_categories_active_name", 'duplicate key value violates unique constraint "ux_product_categories_active_name"'],
    ["product_variants_price_not_negative", 'new row for relation "product_variants" violates check constraint "product_variants_price_not_negative"'],
    ["modifiers_price_not_negative", 'new row for relation "modifiers" violates check constraint "modifiers_price_not_negative"'],
    ["promotions_dates_ordered", 'new row for relation "promotions" violates check constraint "promotions_dates_ordered"'],
    ["promotions_value_valid", 'new row for relation "promotions" violates check constraint "promotions_value_valid"'],
    ["promotions_min_order_not_negative", 'new row for relation "promotions" violates check constraint "promotions_min_order_not_negative"'],
  ];

  it.each(refusals)("%s becomes a Vietnamese sentence, not the generic one", (_name, raw) => {
    const result = describeActionError(new Error(raw));
    expect(result.error).toMatch(/[^\x00-\x7F]/);
    expect(result.error).not.toBe(raw);
    expect(result.error).not.toMatch(/Có lỗi xảy ra/);
  });

  it("maps every constraint and unique index that migration 0132 adds", () => {
    const sql = readFileSync("supabase/migrations/0132_6d_batch_1a.sql", "utf8").replace(/^\s*--.*$/gm, "");
    const names = [
      ...[...sql.matchAll(/add constraint (\w+)/g)].map(m => m[1]),
      ...[...sql.matchAll(/create unique index (\w+)/g)].map(m => m[1]),
    ];
    expect(names.length).toBe(16);
    for (const name of names) {
      const raw = `violates constraint "${name}"`;
      expect(describeActionError(new Error(raw)).error, name).toMatch(/[^\x00-\x7F]/);
    }
  });
});
