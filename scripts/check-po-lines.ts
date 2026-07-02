// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: lines } = await supabase.from("purchase_order_lines").select("*").in("po_id", ["PO-047", "PO-048"]);
  console.log("Lines for PO-47, PO-48:", lines);
}

main().catch(console.error);
