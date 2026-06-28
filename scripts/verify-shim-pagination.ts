/**
 * Verify shim pagination fix: findAll("Orders_V2") should return all 1071 rows.
 * Claude code — Supabase migration Phase B fix verification.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");

  console.log("Verifying shim returns full dataset (not capped at 1000)...");

  const tests = [
    { sheet: "Orders_V2", expected: 1071 },
    { sheet: "Order_Lines_V2", expected: 1521 }, // 1526 - 5 orphans skipped
    { sheet: "Order_Events", expected: 1075 }, // 1076 - 1 orphan skipped
    { sheet: "Stock_Ledger", expected: 5216 },
  ];

  let allPass = true;
  for (const t of tests) {
    const start = Date.now();
    const rows = await findAllNoCache(t.sheet);
    const elapsed = Date.now() - start;
    const pass = rows.length === t.expected;
    console.log(`  ${t.sheet}: ${rows.length} rows (expected ${t.expected}) ${pass ? "PASS" : "FAIL"} ${elapsed}ms`);
    if (!pass) allPass = false;
  }
  console.log(`\nOverall: ${allPass ? "PASS" : "FAIL"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
