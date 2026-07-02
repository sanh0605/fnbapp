// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("promotions").select("*").eq("id", "PRM-004");
  console.log("PRM-004:", data);
}

main().catch(console.error);
