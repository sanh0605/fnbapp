// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: btp } = await supabase.from("semi_products").select("id, name, base_unit").eq("id", "BTP-011").single();
  const { data: unit } = await supabase.from("units").select("*").eq("id", btp.base_unit).single();
  console.log("BTP:", btp);
  console.log("Unit:", unit);
}

main().catch(console.error);
