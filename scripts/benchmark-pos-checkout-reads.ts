import { performance } from "node:perf_hooks";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const REFERENCE_TABLES = [
  "Brands",
  "Products",
  "Product_Variants",
  "Product_Categories",
  "Modifiers",
  "Promotions",
  "Recipes",
  "Base_Ingredients",
  "Semi_Products",
];

async function measure<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  const result = await operation();
  console.log(`${label}: ${(performance.now() - startedAt).toFixed(1)} ms`);
  return result;
}

async function guardRoundTrip(): Promise<void> {
  const { getSupabaseClient } = await import("../lib/supabase");
  await getSupabaseClient().rpc("save_purchase_order_atomic", {
    p_order: [],
    p_lines: [],
    p_ledger: [],
    p_replace_existing: false,
  });
}

async function runRound(round: number): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { getSupabaseClient } = await import("../lib/supabase");
  console.log(`\nRound ${round}`);
  const references = await measure("9 reference tables in parallel", () =>
    Promise.all(REFERENCE_TABLES.map(table => findAllNoCache(table))),
  );
  console.log(
    `Reference rows: ${references.reduce((sum, rows) => sum + rows.length, 0)}`,
  );
  const ledger = await measure("Full Stock_Ledger read", () =>
    findAllNoCache("Stock_Ledger"),
  );
  console.log(`Ledger rows: ${ledger.length}`);
  const compactState = await measure("Compact POS inventory state", async () => {
    const { data, error } = await getSupabaseClient().rpc(
      "get_pos_inventory_state",
      { p_as_of: new Date().toISOString() },
    );
    if (error) throw new Error(error.message);
    return data as {
      balances: Record<string, number>;
      mac_unit_costs: Record<string, number>;
    };
  });
  console.log(
    `Compact items: ${Object.keys(compactState.balances).length} balances, ` +
    `${Object.keys(compactState.mac_unit_costs).length} MAC costs`,
  );
  const ordersFirst = await measure("Full Orders_V2 read #1", () =>
    findAllNoCache("Orders_V2"),
  );
  const ordersSecond = await measure("Full Orders_V2 read #2", () =>
    findAllNoCache("Orders_V2"),
  );
  console.log(`Order rows: ${ordersFirst.length}/${ordersSecond.length}`);
  await measure("Targeted latest order number query", async () => {
    const { error } = await getSupabaseClient()
      .from("orders_v2")
      .select("order_no")
      .like("order_no", "PHD%")
      .order("order_no", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
  });
  await measure("One database round trip", guardRoundTrip);
  await measure("Four sequential database round trips", async () => {
    for (let index = 0; index < 4; index += 1) {
      await guardRoundTrip();
    }
  });
}

async function main(): Promise<void> {
  console.log("=== POS CHECKOUT READ BENCHMARK (READ ONLY) ===");
  for (let round = 1; round <= 3; round += 1) {
    await runRound(round);
  }
  console.log("\nNo order or operational data was written.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
