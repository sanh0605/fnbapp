// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: base } = await supabase.from("base_ingredients").select("*").eq("id", "ING-032").single();
  console.log("ING-032:", base);
}

main().catch(console.error);
