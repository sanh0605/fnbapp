// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: item } = await supabase.from("purchased_items").select("*").eq("id", "SPM-041").single();
  console.log("SPM-041:", item);
}

main().catch(console.error);
