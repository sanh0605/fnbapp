import { getSupabaseClient } from "@/lib/supabase";

export type ManualIssueResult = {
  issueId: string;
  ledgerId: string;
  purchasedItemId: string;
  baseIngredientId: string;
  baseQuantity: number;
  issuedAt: string;
  onHandBefore: number;
  onHandAfter: number;
  createdById: string;
  createdByName: string;
};

export async function createManualIssueAtomic(input: {
  purchasedItemId: string;
  baseQuantity: number;
  issuedAt: Date;
  note: string;
  createdById: string;
  createdByName: string;
}): Promise<ManualIssueResult> {
  const { data, error } = await getSupabaseClient().rpc("create_manual_issue_atomic", {
    p_purchased_item_id: input.purchasedItemId,
    p_base_quantity: input.baseQuantity,
    p_issued_at: input.issuedAt.toISOString(),
    p_note: input.note,
    p_created_by_id: input.createdById,
    p_created_by_name: input.createdByName,
  });
  if (error) {
    throw new Error(`create_manual_issue_atomic: ${error.message}`);
  }
  return parseManualIssueResult(data);
}

function parseManualIssueResult(data: unknown): ManualIssueResult {
  const result = data as {
    issue_id?: string;
    ledger_id?: string;
    purchased_item_id?: string;
    base_ingredient_id?: string;
    base_quantity?: number;
    issued_at?: string;
    on_hand_before?: number;
    on_hand_after?: number;
    created_by_id?: string;
    created_by_name?: string;
  } | null;
  if (!result?.issue_id || !result.ledger_id) {
    throw new Error("create_manual_issue_atomic returned an invalid result");
  }
  return {
    issueId: result.issue_id,
    ledgerId: result.ledger_id,
    purchasedItemId: result.purchased_item_id || "",
    baseIngredientId: result.base_ingredient_id || "",
    baseQuantity: Number(result.base_quantity) || 0,
    issuedAt: result.issued_at || "",
    onHandBefore: Number(result.on_hand_before) || 0,
    onHandAfter: Number(result.on_hand_after) || 0,
    createdById: result.created_by_id || "",
    createdByName: result.created_by_name || "",
  };
}
