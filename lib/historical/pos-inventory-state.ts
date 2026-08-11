import { getSupabaseClient } from "@/lib/supabase";

export type PosInventoryState = {
  balances: Map<string, number>;
  macUnitCosts: Map<string, number>;
};

type PosInventoryStateResult = {
  balances: Record<string, unknown>;
  mac_unit_costs: Record<string, unknown>;
};

export async function getPosInventoryState(
  asOf: string,
): Promise<PosInventoryState> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_pos_inventory_state",
    { p_as_of: asOf },
  );
  if (error) {
    throw new Error(`get_pos_inventory_state: ${error.message}`);
  }
  if (!isRecord(data) || !isRecord(data.balances) || !isRecord(data.mac_unit_costs)) {
    throw new Error("get_pos_inventory_state returned an invalid result");
  }

  return {
    balances: toNumberMap(data.balances),
    macUnitCosts: toNumberMap(data.mac_unit_costs),
  };
}

function toNumberMap(values: Record<string, unknown>): Map<string, number> {
  const result = new Map<string, number>();
  for (const [key, rawValue] of Object.entries(values)) {
    const value = Number(rawValue);
    if (!key || !Number.isFinite(value)) {
      throw new Error("get_pos_inventory_state returned an invalid result");
    }
    result.set(key, value);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
