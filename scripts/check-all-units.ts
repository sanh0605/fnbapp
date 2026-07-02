// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: base } = await supabase.from("base_ingredients").select("id, name, base_unit");
  const { data: units } = await supabase.from("units").select("id, name");
  
  for (const b of base) {
    const u = units.find(u => u.id === b.base_unit);
    if (u && u.name !== 'g' && u.name !== 'ml' && u.name !== 'trái') {
       console.log(`Ingredient ${b.name} (${b.id}) has unit: ${u.name}`);
    }
  }
}

main().catch(console.error);
