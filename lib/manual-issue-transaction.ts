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

export type ReversalResult = {
  reversalIssueId: string;
  ledgerId: string;
  reversesIssueId: string;
  purchasedItemId: string;
  baseIngredientId: string;
  baseQuantity: number;
  issuedAt: string;
  createdById: string;
  createdByName: string;
};

// Plan D D7b / BR-INV-009: reverse a mistaken manual issue slip. Lands
// today, at today's live average -- see BR-INV-009 for why. No on-hand
// check on this path (unlike createManualIssueAtomic): a reversal only
// ever returns an exact, already-issued quantity, so it can never exceed
// what is on hand.
export async function reverseManualIssueAtomic(input: {
  issueId: string;
  note: string;
  createdById: string;
  createdByName: string;
}): Promise<ReversalResult> {
  const { data, error } = await getSupabaseClient().rpc("reverse_manual_issue_atomic", {
    p_issue_id: input.issueId,
    p_note: input.note,
    p_created_by_id: input.createdById,
    p_created_by_name: input.createdByName,
  });
  if (error) {
    throw new Error(`reverse_manual_issue_atomic: ${error.message}`);
  }
  return parseReversalResult(data);
}

function parseReversalResult(data: unknown): ReversalResult {
  const result = data as {
    reversal_issue_id?: string;
    ledger_id?: string;
    reverses_issue_id?: string;
    purchased_item_id?: string;
    base_ingredient_id?: string;
    base_quantity?: number;
    issued_at?: string;
    created_by_id?: string;
    created_by_name?: string;
  } | null;
  if (!result?.reversal_issue_id || !result.ledger_id || !result.reverses_issue_id) {
    throw new Error("reverse_manual_issue_atomic returned an invalid result");
  }
  return {
    reversalIssueId: result.reversal_issue_id,
    ledgerId: result.ledger_id,
    reversesIssueId: result.reverses_issue_id,
    purchasedItemId: result.purchased_item_id || "",
    baseIngredientId: result.base_ingredient_id || "",
    baseQuantity: Number(result.base_quantity) || 0,
    issuedAt: result.issued_at || "",
    createdById: result.created_by_id || "",
    createdByName: result.created_by_name || "",
  };
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
