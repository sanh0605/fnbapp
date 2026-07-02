// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: units } = await supabase.from("units").select("*").eq("id", "UNT-017").single();
  console.log("Unit UNT-017:", units);
}

main().catch(console.error);
