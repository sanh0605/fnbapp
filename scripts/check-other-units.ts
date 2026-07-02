// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: ing3 } = await supabase.from("base_ingredients").select("id, name, base_unit").eq("id", "ING-003").single();
  const { data: unit3 } = await supabase.from("units").select("*").eq("id", ing3.base_unit).single();
  console.log("ING-003:", ing3, unit3.name);
  
  const { data: nnl2 } = await supabase.from("base_ingredients").select("id, name, base_unit").eq("id", "NNL-002").single();
  const { data: unitNnl2 } = await supabase.from("units").select("*").eq("id", nnl2.base_unit).single();
  console.log("NNL-002:", nnl2, unitNnl2.name);
}

main().catch(console.error);
