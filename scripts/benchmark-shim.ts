/**
 * Benchmark shim performance for hot read paths.
 *
 * Claude code — Supabase migration perf investigation.
 *
 * Measures:
 *   - findAll() individual tables (raw read time)
 *   - getSalesDataV2 + getPnLDataV2 (composite report time)
 *
 * Run: vite-node scripts/benchmark-shim.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function timeit<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  console.log(`${label}: ${elapsed}ms`);
  return result;
}

async function main() {
  console.log("=== SHIM BENCHMARK ===\n");

  // 1. Raw findAll on hot tables.
  const { findAllNoCache } = await import("../lib/sheets_db");
  const tables = [
    "Orders_V2",        // ~1098 rows
    "Order_Lines_V2",   // ~1552 rows
    "Order_Events",     // ~1104 rows
    "Stock_Ledger",     // ~5307 rows
    "Products",         // ~35 rows
    "Product_Variants", // ~44 rows
    "Recipes",          // ~106 rows
    "Base_Ingredients", // ~41 rows
    "Semi_Products",    // ~13 rows
    "Modifiers",        // ~8 rows
    "Promotions",       // ~1 row
    "Brands",           // ~2 rows
    "Units",            // ~27 rows
  ];

  for (const t of tables) {
    await timeit(`findAll(${t})`, async () => {
      const rows = await findAllNoCache(t);
      return rows.length;
    });
  }

  // 2. Re-fetch same tables (cache hot for non-CLI mode, but CLI bypasses).
  console.log("\n--- Re-fetch (should be similar, CLI bypasses cache) ---");
  await timeit("findAll(Orders_V2) again", async () => {
    return (await findAllNoCache("Orders_V2")).length;
  });

  // 3. Composite report (heavy: reads orders + lines + ledger + recipes etc.).
  console.log("\n--- Composite reports ---");
  await timeit("getSalesDataV2 (default filter = start of month to today)", async () => {
    const { getSalesDataV2 } = await import("../app/admin/reports/actions");
    return (await getSalesDataV2({})).totalOrders;
  });

  await timeit("getPnLDataV2 (default filter = start of month to today)", async () => {
    const { getPnLDataV2 } = await import("../app/admin/reports/actions");
    return (await getPnLDataV2({})).orderCount;
  });

  // 4. Direct Supabase query (no shim) to compare overhead.
  console.log("\n--- Direct Supabase (no shim, no cache) ---");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  await timeit("direct .from('orders_v2').select('*').limit(100)", async () => {
    const { data, error } = await supabase.from("orders_v2").select("*").limit(100);
    if (error) throw error;
    return data?.length;
  });
  await timeit("direct .from('orders_v2').select('*') (all rows)", async () => {
    const all: any[] = [];
    let page = 0;
    while (true) {
      const { data } = await supabase.from("orders_v2").select("*").range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
      page += 1;
    }
    return all.length;
  });

  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
