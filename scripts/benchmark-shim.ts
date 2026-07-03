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
import { isDeepStrictEqual } from "node:util";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function timeit<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  console.log(`${label}: ${elapsed}ms`);
  return result;
}

function currentSaigonMonthRange(): { startDate: string; endDate: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    startDate: `${values.year}-${values.month}-01`,
    endDate: `${values.year}-${values.month}-${values.day}`,
  };
}

function benchmarkSync<T>(
  label: string,
  iterations: number,
  fn: () => T,
): T {
  const start = performance.now();
  let result: T | undefined;
  for (let index = 0; index < iterations; index += 1) {
    result = fn();
  }
  const averageMs = (performance.now() - start) / iterations;
  console.log(`${label}: ${averageMs.toFixed(2)}ms average (${iterations} runs)`);
  return result as T;
}

async function main() {
  console.log("=== SHIM BENCHMARK ===\n");

  // 1. Raw findAll on hot tables.
  const { findAllNoCache, findAllWhere } = await import("../lib/sheets_db");
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

  // 3. Verify SQL push-down parity against the legacy in-memory candidate set.
  const reportFilters = currentSaigonMonthRange();
  const { toSaigonUtcRange } = await import("../lib/report-time");
  const dateRange = toSaigonUtcRange(reportFilters.startDate, reportFilters.endDate)!;
  let legacyAllCount = 0;
  const legacyOrders = await timeit("legacy Orders_V2 load + in-memory filter", async () => {
    const rows = await findAllNoCache("Orders_V2");
    legacyAllCount = rows.length;
    return rows.filter((row: any) => {
      const createdAt = new Date(row.created_at);
      return row.status === "COMPLETED"
        && createdAt >= dateRange.startUtc
        && createdAt <= dateRange.endUtc;
    });
  });
  const pushedOrders = await timeit("findAllWhere(Orders_V2) SQL push-down", async () => (
    findAllWhere("Orders_V2", {
      gte: { created_at: dateRange.startUtc },
      lte: { created_at: dateRange.endUtc },
      eq: { status: "COMPLETED" },
    })
  ));
  const legacyIds = legacyOrders.map((row: any) => row.id).sort();
  const pushedIds = pushedOrders.map((row: any) => row.id).sort();
  if (JSON.stringify(legacyIds) !== JSON.stringify(pushedIds)) {
    console.error("Legacy all-row count:", legacyAllCount);
    console.error("Parity range:", {
      startUtc: dateRange.startUtc.toISOString(),
      endUtc: dateRange.endUtc.toISOString(),
    });
    console.error(
      "Pushed sample:",
      pushedOrders.slice(0, 5).map((row: any) => ({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
      })),
    );
    throw new Error(
      `findAllWhere parity failed: legacy=${legacyIds.length}, pushed=${pushedIds.length}`,
    );
  }
  console.log(`Orders_V2 parity: ${pushedIds.length}/${legacyIds.length} matching IDs`);

  // 4. Isolate MAC index work from report I/O.
  console.log("\n--- MAC ledger index ---");
  const macLedger = await findAllNoCache("Stock_Ledger");
  const { createMacLedgerIndex } = await import("../lib/mac-cogs");
  benchmarkSync("createMacLedgerIndex", 25, () => createMacLedgerIndex(macLedger));
  benchmarkSync(
    "two independent P&L index builds",
    25,
    () => [
      createMacLedgerIndex(macLedger),
      createMacLedgerIndex(macLedger),
    ],
  );
  const sharedIndexes = benchmarkSync(
    "one request-scoped P&L index build",
    25,
    () => {
      const index = createMacLedgerIndex(macLedger);
      return [index, index];
    },
  );
  if (sharedIndexes[0] !== sharedIndexes[1]) {
    throw new Error("P&L allocators did not receive the same request-scoped index");
  }

  // 5. Composite report (heavy: reads orders + lines + ledger + recipes etc.).
  console.log("\n--- Composite reports ---");
  await timeit("getSalesDataV2 (start of month to today)", async () => {
    const { getSalesDataV2 } = await import("../app/admin/reports/actions");
    return (await getSalesDataV2(reportFilters)).totalOrders;
  });

  const { getPnLDataV2 } = await import("../app/admin/reports/actions");
  const firstPnl = await timeit("getPnLDataV2 request-scoped index run 1", async () => (
    getPnLDataV2(reportFilters)
  ));
  const secondPnl = await timeit("getPnLDataV2 request-scoped index run 2", async () => (
    getPnLDataV2(reportFilters)
  ));
  if (firstPnl.orderCount === 0) {
    throw new Error("P&L request-scoped index benchmark returned no orders");
  }
  if (!isDeepStrictEqual(secondPnl, firstPnl)) {
    throw new Error("P&L parity failed between request-scoped index runs");
  }
  console.log(
    `P&L request-scoped parity: ${secondPnl.orderCount} orders, `
    + `${secondPnl.totalCOGS} VND COGS, `
    + `${secondPnl.cogsDetails.length} ingredient rows`,
  );

  // 6. Direct Supabase query (no shim) to compare overhead.
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
