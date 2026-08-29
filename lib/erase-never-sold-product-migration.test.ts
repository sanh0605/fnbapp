import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// No live Postgres connection is available to this session, and the
// migration itself is deliberately not applied here -- the owner approves
// that separately (CLAUDE.md section 2). This proves the same fact at the
// level lib/order-edit-transaction-migration.test.ts already operates at:
// the function's SQL text, not its executed behaviour.
const sql = readFileSync(
  resolve("supabase/migrations/0075_erase_never_sold_product.sql"),
  "utf8",
).toLowerCase();

describe("0075 erase_never_sold_product_atomic migration", () => {
  it("deletes in order: price history, then variants, then the product", () => {
    const priceHistoryIdx = sql.indexOf("delete from public.product_price_history");
    const variantsIdx = sql.indexOf("delete from public.product_variants");
    const productIdx = sql.indexOf("delete from public.products");

    expect(priceHistoryIdx).toBeGreaterThan(-1);
    expect(variantsIdx).toBeGreaterThan(-1);
    expect(productIdx).toBeGreaterThan(-1);
    expect(priceHistoryIdx).toBeLessThan(variantsIdx);
    expect(variantsIdx).toBeLessThan(productIdx);
  });

  it("all three deletes sit inside one exception-catching block, so a refusal rolls all three back together", () => {
    const blockStart = sql.indexOf("begin", sql.indexOf("for update"));
    const exceptionIdx = sql.indexOf("exception", blockStart);
    const priceHistoryIdx = sql.indexOf("delete from public.product_price_history");
    const productIdx = sql.indexOf("delete from public.products");

    expect(blockStart).toBeGreaterThan(-1);
    expect(exceptionIdx).toBeGreaterThan(-1);
    // All three deletes fall between the inner begin and its exception clause.
    expect(priceHistoryIdx).toBeGreaterThan(blockStart);
    expect(productIdx).toBeLessThan(exceptionIdx);
  });

  it("translates the RESTRICT refusal into a Vietnamese sentence naming the product, not a raw constraint error", () => {
    expect(sql).toContain("when foreign_key_violation then");
    expect(sql).toContain("đã có đơn hàng nên không thể xoá vĩnh viễn");
    expect(sql).toContain("v_product_name");
    // The suggested next action, not just the refusal.
    expect(sql).toContain("ngừng bán");
  });

  it("locks the product row before deleting anything, so two concurrent erase attempts cannot race", () => {
    expect(sql).toContain("for update");
  });

  it("limits execution to the service role", () => {
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain("to service_role");
  });
});
