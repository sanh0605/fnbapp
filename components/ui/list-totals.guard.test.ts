import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-004: the cash book and the asset list filter in the browser, so their
// totals come from helpers run on the filtered rows (lib/finance/cash-book-rows.ts,
// lib/assets/asset-items.ts) and are handed to DataList's totals.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("BR-UI-004 browser-filtered lists pass their totals to the list", () => {
  it("Sổ thu chi sums its filtered rows", () => {
    const src = read("app/admin/finance/components/CashBookClient.tsx");
    expect(src).toMatch(/cashBookRowTotals\(\s*filteredRows\s*\)/);
    expect(src).toMatch(/totals=\{/);
  });

  it("Tài sản sums its filtered rows", () => {
    const src = read("app/admin/inventory/assets/components/AssetsClient.tsx");
    expect(src).toMatch(/assetItemTotals\(\s*filteredAssets\s*\)/);
    expect(src).toMatch(/totals=\{/);
  });

  it("Đơn hàng's page hands the totals to the table", () => {
    expect(read("app/admin/orders/page.tsx")).toMatch(/totals=\{/);
  });
});
