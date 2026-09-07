import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "app/admin/inventory/purchase-orders/actions.ts",
  ),
  "utf8",
);

describe("purchase order action integration", () => {
  it("uses the atomic RPC instead of client-side multi-step writes", () => {
    expect(source).toContain("savePurchaseOrderAtomic");
    expect(source).not.toContain('generateNewId("Purchase_Orders"');
    expect(source).not.toContain('update("Purchase_Orders"');
    expect(source).not.toContain('removeMany("Purchase_Order_Lines"');
    expect(source).not.toContain('removeMany("Stock_Ledger"');
    expect(source).not.toContain('insertMany("Purchase_Order_Lines"');
    expect(source).not.toContain('insertMany("Stock_Ledger"');
  });

  it("invalidates purchase and inventory caches after a successful save", () => {
    expect(source).toContain('revalidateTag("sheets-Purchase_Orders")');
    expect(source).toContain('revalidateTag("sheets-Purchase_Order_Lines")');
  });

  // section 2,
  // point 2: stock_ledger was dropped by Phase D (migration 0096, applied).
  // Busting the cache tag for a table that no longer exists is meaningless,
  // not merely harmless -- removed rather than left as dead noise.
  it("no longer revalidates the retired stock_ledger cache tag", () => {
    expect(source).not.toContain("sheets-Stock_Ledger");
  });
});
