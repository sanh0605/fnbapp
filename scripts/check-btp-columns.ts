// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: btp } = await supabase.from("semi_products").select("*").limit(1);
  console.log("semi_products columns:", Object.keys(btp[0]));
}

main().catch(console.error);
