// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { getMacUnitCost } from "../lib/mac-cogs";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: ledger } = await supabase.from("stock_ledger").select("*");
  const { data: ingredients } = await supabase.from("base_ingredients").select("*");
  
  const now = new Date().toISOString();
  
  for (const ing of ingredients) {
    const mac = getMacUnitCost(ledger || [], ing.id, now);
    console.log(`Ingredient ${ing.id} (${ing.name}): MAC = ${mac}`);
  }
}

main().catch(console.error);
