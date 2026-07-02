// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: ing } = await supabase.from("base_ingredients").select("id, name, base_unit").eq("id", "ING-012").single();
  const { data: unit } = await supabase.from("units").select("*").eq("id", ing.base_unit).single();
  console.log("Ingredient:", ing);
  console.log("Unit:", unit);
}

main().catch(console.error);
