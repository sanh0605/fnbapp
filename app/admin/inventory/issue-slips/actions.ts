"use server";

import { findAll, findAllWhere } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import {
  createIssueSlipAtomic,
  reverseManualIssueAtomic,
  cancelIssueSlipAtomic,
  type IssueSlipResult,
  type ReversalResult,
  type SlipCancelResult,
} from "@/lib/manual-issue-transaction";
import { buildPackageLines, type PackageLine, type PurchasedItemConversion } from "@/lib/stocktake-package-lines";
import { computeOnHandByPurchasedItem, filterByC17 } from "@/lib/purchased-item-onhand";

const PATH = "/admin/inventory/issue-slips";
const RECENT_SLIPS_LIMIT = 100;

export interface IssueSlipItemView {
  id: string;
  name: string;
  onHand: number;
  unitName: string;
  packageLines: PackageLine[];
}

export async function getIssueSlipFormData(): Promise<IssueSlipItemView[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [purchasedItems, conversions, units, itemCategories] = await Promise.all([
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Units"),
    findAll("Item_Categories"),
  ]);
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  const nameById = new Map<string, string>((purchasedItems as any[]).map(p => [p.id, p.name]));
  // used to check the linked base_ingredient's own flag instead of the
  // item's -- a gap the stocktake screen never had, since it already also
  // checked the item's own flag (Plan D Gap 1 below). That gap let 7 items
  // that carry the flag directly, with no linked ingredient at all (the
  // bags, Muỗng nhựa đen), stay offered here despite being excluded from
  // stocktake -- daily-expense items (đá viên, chanh, quất...) carry
  // is_non_inventory and are never tracked as real stock, nothing for an
  // issue slip to draw down, whichever table the flag happens to sit on.
  // section
  // 3.1: same test the stocktake screen already uses
  // (app/admin/inventory/stocktake/actions.ts) -- equipment leaves through
  // the asset register (docs/superpowers/plans/2026-08-22-batch-3-asset-
  // register.md), never through a stock issue. Deliberately not written as
  // a second, independent test: reusing system_type === "EQUIPMENT" means
  // the two screens can only ever agree or both be wrong the same way.
  const equipmentCategoryIds = new Set(
    (itemCategories as any[]).filter(c => c.system_type === "EQUIPMENT").map(c => c.id as string),
  );

  const input: PurchasedItemConversion[] = (conversions as any[]).map(c => ({
    conversionId: c.id,
    purchasedItemId: c.purchased_item_id,
    purchasedItemName: nameById.get(c.purchased_item_id) ?? c.purchased_item_id,
    purchasedUnitName: unitNameById.get(c.purchased_unit) ?? c.purchased_unit ?? "",
    baseUnitName: unitNameById.get(c.base_unit) ?? c.base_unit ?? "",
    conversionRate: Number(c.conversion_rate),
    status: c.status,
    purchaseOnly: c.purchase_only === true,
  }));
  const packageLinesByPurchasedItem = new Map<string, PackageLine[]>();
  for (const line of buildPackageLines(input)) {
    const list = packageLinesByPurchasedItem.get(line.purchasedItemId) ?? [];
    list.push(line);
    packageLinesByPurchasedItem.set(line.purchasedItemId, list);
  }

  const eligiblePurchasedItems = (purchasedItems as any[]).filter(
    p => p.is_non_inventory !== true && p.is_non_inventory !== "TRUE" && !equipmentCategoryIds.has(p.item_category_id),
  );
  // Same C17 shape as the stocktake screen: an inactive item stays offered
  // while it still has stock to issue out; it is dropped only once it has
  // none left.
  const eligible = await filterByC17(eligiblePurchasedItems);
  const onHandById = await computeOnHandByPurchasedItem();

  // OPEN-ITEMS 41: purchased_items.default_unit_id is null on every row, so
  // it can never label onHand. The base unit comes from
  // UOM_Conversions.base_unit instead -- the same fix G4 (7882894) applied
  // to app/admin/reports/issued. Verified 2026-08-17 against live data: all
  // 52 purchased items have at least one ACTIVE conversion, and every
  // ACTIVE conversion's base_unit agrees with its own ingredient/semi-product's
  // canonical base_unit -- zero disagreements. (SPM-043's conversion QD-049
  // disagreed with its ingredient until the same day, when the owner
  // confirmed and applied the correction -- see git history for the
  // now-removed special case this replaced.)
  const conversionBaseUnitIdByPurchasedItem = new Map<string, string>();
  for (const c of conversions as any[]) {
    if (c.status !== "ACTIVE") continue;
    conversionBaseUnitIdByPurchasedItem.set(c.purchased_item_id, c.base_unit);
  }

  return eligible
    .map(p => ({
      id: p.id as string,
      name: p.name as string,
      onHand: onHandById.get(p.id) ?? 0,
      unitName: unitNameById.get(conversionBaseUnitIdByPurchasedItem.get(p.id) ?? "") ?? "",
      packageLines: packageLinesByPurchasedItem.get(p.id) ?? [],
    }))
    .filter(item => item.packageLines.length > 0) // nothing to select without at least one active conversion
    // section 4: offering a zero-stock item offers something the RPC will
    // always refuse (I4/I5). Filtered HERE, not in filterByC17 -- that
    // helper is shared with the stocktake screen, which must keep showing
    // a zero-stock item (counting exists to find out the system's zero is
    // wrong). computeOnHandByPurchasedItem has no notion of "as of a date"
    // at all -- it sums every completed purchase and every issue,
    // unconditionally -- while the RPC checks stock as of p_issued_at, and
    // this screen lets the owner backdate a slip. A slip backdated to
    // before an item was fully consumed would disagree with the RPC on
    // whether it has stock, and the RPC wins. The payload this function
    // returns has no way to carry a chosen issue date (it is built once,
    // before the form's own datetime field exists on screen), so this
    // filters on TODAY's on-hand and says so here rather than shipping a
    // quiet mismatch -- a real, known gap, not a solved one.
    .filter(item => item.onHand > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

// Plan D D9: one slip, one time, many lines -- the owner's own review of
// the D7a screen ("tại sao chỉ cho xuất đúng 1 sản phẩm"). Whole slip is
// validated and written in one RPC call; I4/I10 are enforced there, not
// re-derived here.
export async function createIssueSlip(input: {
  issuedAtIso: string;
  note: string;
  lines: Array<{ purchasedItemId: string; baseQuantity: number }>;
}): Promise<ActionResponse & { result?: IssueSlipResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const issuedAt = new Date(input.issuedAtIso);
  if (Number.isNaN(issuedAt.getTime())) {
    return fail("Thời điểm xuất không hợp lệ");
  }
  if (input.lines.length === 0) {
    return fail("Phiếu cần ít nhất một dòng");
  }
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    if (!line.purchasedItemId) return fail(`Dòng ${i + 1}: chưa chọn mặt hàng`);
    if (!Number.isFinite(line.baseQuantity) || line.baseQuantity <= 0) {
      return fail(`Dòng ${i + 1}: số lượng phải lớn hơn 0`);
    }
  }

  try {
    const result = await createIssueSlipAtomic({
      issuedAt,
      note: input.note,
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
      lines: input.lines,
    });
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export interface IssueSlipRow {
  id: string;
  slipId: string | null;
  itemName: string;
  baseQuantity: number;
  issuedAt: string;
  note: string;
  // Plan D D7b, BR-INV-009: a row is either an ordinary MANUAL issue, or
  // itself a compensating entry for an earlier one (reversesIssueId set).
  // reversedByIssueId is the reverse direction, derived from this same
  // fetched window -- "hai chiều" (both directions visible), the original
  // row itself never mutated.
  reversesIssueId: string | null;
  reversedByIssueId: string | null;
}

export async function getRecentIssueSlips(): Promise<IssueSlipRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [rows, purchasedItems] = await Promise.all([
    findAllWhere<any>("Stock_Issues", {
      eq: { source: "MANUAL" },
      order: { column: "created_at", ascending: false },
      limit: RECENT_SLIPS_LIMIT,
    }),
    findAll("Purchased_Items"),
  ]);
  const nameById = new Map<string, string>((purchasedItems as any[]).map(p => [p.id, p.name]));
  const reversedByIdByOriginal = new Map<string, string>();
  for (const row of rows) {
    if (row.reverses_issue_id) reversedByIdByOriginal.set(row.reverses_issue_id, row.id);
  }

  return rows.map(row => ({
    id: row.id,
    // Plan D D9: rows written before this migration (or, in principle, any
    // row written outside a slip) carry no issue_slip_id -- shown
    // individually rather than grouped, not an error.
    slipId: row.issue_slip_id ?? null,
    itemName: nameById.get(row.purchased_item_id) ?? row.purchased_item_id,
    baseQuantity: Number(row.base_quantity),
    issuedAt: row.issued_at,
    note: row.note ?? "",
    reversesIssueId: row.reverses_issue_id ?? null,
    reversedByIssueId: reversedByIdByOriginal.get(row.id) ?? null,
  }));
}

// Plan D D9 / I11: reversal stays per-line, unchanged from D7b -- a
// multi-line slip still writes one stock_issues row per line, so
// correcting one wrong line does not require touching the rest of the
// slip.
export async function reverseIssueSlip(input: {
  issueId: string;
  note: string;
}): Promise<ActionResponse & { result?: ReversalResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const result = await reverseManualIssueAtomic({
      issueId: input.issueId,
      note: input.note,
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
    });
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// Plan D D14 / I11: cancel a WHOLE slip -- reverses every line not already
// individually reversed, in one call, one reason. Same requireAdmin() level
// as the existing per-line reversal above -- deliberately not raised to
// owner-only (U12): an issue slip records waste/internal use, not a check on
// the person who counted, so the stocktake reversal's stricter guard does
// not carry over here.
export async function cancelIssueSlip(input: {
  slipId: string;
  reason: string;
}): Promise<ActionResponse & { result?: SlipCancelResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!input.reason.trim()) {
    return fail("Lý do huỷ phiếu là bắt buộc");
  }

  try {
    const result = await cancelIssueSlipAtomic({
      slipId: input.slipId,
      reason: input.reason.trim(),
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
    });
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
