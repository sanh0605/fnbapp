// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: products } = await supabase.from("products").select("*").ilike("name", "%caramel%");
  console.log("Products:", products);
}

main().catch(console.error);
