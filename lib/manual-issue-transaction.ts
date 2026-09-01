import { getSupabaseClient } from "@/lib/supabase";

export type IssueSlipLineResult = {
  issueId: string;
  purchasedItemId: string;
  baseQuantity: number;
  onHandAfter: number;
};

export type IssueSlipResult = {
  slipId: string;
  issuedAt: string;
  note: string;
  createdById: string;
  createdByName: string;
  lines: IssueSlipLineResult[];
};

// Plan D D9: one slip, one time, many lines -- mirrors PurchaseOrderForm's
// own shape (one purchase order, many purchase_order_lines). Superseded
// createManualIssueAtomic (0057), which forced one item per slip; a
// single-line slip is just the degenerate case of this. I10: two lines
// naming the same purchased item are allowed and checked cumulatively by
// the RPC itself, not merged here. Atomic: any line failing anywhere
// aborts the whole slip, nothing written.
export async function createIssueSlipAtomic(input: {
  issuedAt: Date;
  note: string;
  createdById: string;
  createdByName: string;
  lines: Array<{ purchasedItemId: string; baseQuantity: number }>;
}): Promise<IssueSlipResult> {
  const { data, error } = await getSupabaseClient().rpc("create_issue_slip_atomic", {
    p_issued_at: input.issuedAt.toISOString(),
    p_note: input.note,
    p_created_by_id: input.createdById,
    p_created_by_name: input.createdByName,
    p_lines: input.lines.map(l => ({ purchased_item_id: l.purchasedItemId, base_quantity: l.baseQuantity })),
  });
  if (error) {
    throw new Error(`create_issue_slip_atomic: ${error.message}`);
  }
  return parseIssueSlipResult(data);
}

function parseIssueSlipResult(data: unknown): IssueSlipResult {
  const result = data as {
    slip_id?: string;
    issued_at?: string;
    note?: string;
    created_by_id?: string;
    created_by_name?: string;
    lines?: Array<{
      issue_id?: string;
      purchased_item_id?: string;
      base_quantity?: number;
      on_hand_after?: number;
    }>;
  } | null;
  if (!result?.slip_id || !result.lines || result.lines.length === 0) {
    throw new Error("create_issue_slip_atomic returned an invalid result");
  }
  const lines = result.lines.map(line => {
    // docs/superpowers/plans/2026-08-30-issue-slips-for-consumables.md:
    // ledger_id used to be required here, back when the RPC still wrote a
    // stock_ledger row and returned its id. The migration stops writing
    // that row for every line, raw ingredient or consumable, so ledger_id
    // no longer exists in the RPC's response at all -- requiring it here
    // would fail every issue slip, not just a consumable one.
    if (!line.issue_id) {
      throw new Error("create_issue_slip_atomic returned an invalid line result");
    }
    return {
      issueId: line.issue_id,
      purchasedItemId: line.purchased_item_id || "",
      baseQuantity: Number(line.base_quantity) || 0,
      onHandAfter: Number(line.on_hand_after) || 0,
    };
  });
  return {
    slipId: result.slip_id,
    issuedAt: result.issued_at || "",
    note: result.note || "",
    createdById: result.created_by_id || "",
    createdByName: result.created_by_name || "",
    lines,
  };
}

export type ReversalResult = {
  reversalIssueId: string;
  reversesIssueId: string;
  purchasedItemId: string;
  baseQuantity: number;
  issuedAt: string;
  createdById: string;
  createdByName: string;
};

// Plan D D7b / BR-INV-009: reverse a mistaken manual issue slip LINE. Lands
// today, at today's live average -- see BR-INV-009 for why. No on-hand
// check on this path: a reversal only ever returns an exact, already-
// issued quantity, so it can never exceed what is on hand.
//
// D9 / I11: stays per-line, unchanged. A multi-line slip still writes one
// stock_issues row per line, so this reverses exactly one of them --
// correcting one wrong line out of five does not require touching the
// other four.
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

export type SlipCancelResult = {
  slipId: string;
  reason: string;
  reversedCount: number;
  reversals: ReversalResult[];
};

// Plan D D14 / I11: cancel a WHOLE slip -- reverses every line not already
// individually reversed, in one call. Composes reverse_manual_issue_atomic
// per line server-side (see migration 0062); the existing per-line
// reverseManualIssueAtomic above is unchanged and stays available for a
// single wrong line.
export async function cancelIssueSlipAtomic(input: {
  slipId: string;
  reason: string;
  createdById: string;
  createdByName: string;
}): Promise<SlipCancelResult> {
  const { data, error } = await getSupabaseClient().rpc("cancel_issue_slip_atomic", {
    p_slip_id: input.slipId,
    p_reason: input.reason,
    p_created_by_id: input.createdById,
    p_created_by_name: input.createdByName,
  });
  if (error) {
    throw new Error(`cancel_issue_slip_atomic: ${error.message}`);
  }
  return parseSlipCancelResult(data);
}

function parseSlipCancelResult(data: unknown): SlipCancelResult {
  const result = data as {
    slip_id?: string;
    reason?: string;
    reversed_count?: number;
    reversals?: unknown[];
  } | null;
  if (!result?.slip_id || !result.reversed_count) {
    throw new Error("cancel_issue_slip_atomic returned an invalid result");
  }
  return {
    slipId: result.slip_id,
    reason: result.reason || "",
    reversedCount: Number(result.reversed_count) || 0,
    reversals: (result.reversals || []).map(parseReversalResult),
  };
}

function parseReversalResult(data: unknown): ReversalResult {
  const result = data as {
    reversal_issue_id?: string;
    reverses_issue_id?: string;
    purchased_item_id?: string;
    base_quantity?: number;
    issued_at?: string;
    created_by_id?: string;
    created_by_name?: string;
  } | null;
  // docs/superpowers/plans/2026-08-30-issue-slips-for-consumables.md: same
  // ledger_id retirement as parseIssueSlipResult above -- the RPC no longer
  // writes or returns one, for a raw-ingredient reversal or a consumable's.
  if (!result?.reversal_issue_id || !result.reverses_issue_id) {
    throw new Error("reverse_manual_issue_atomic returned an invalid result");
  }
  return {
    reversalIssueId: result.reversal_issue_id,
    reversesIssueId: result.reverses_issue_id,
    purchasedItemId: result.purchased_item_id || "",
    baseQuantity: Number(result.base_quantity) || 0,
    issuedAt: result.issued_at || "",
    createdById: result.created_by_id || "",
    createdByName: result.created_by_name || "",
  };
}
