"use server";

import { findAll, findAllNoCache } from "@/lib/db/tables";
import { buildIssueCostingPurchases, selectCostedIssues } from "@/lib/costing/issue-costing-inputs";
import { computeIssueLineValues } from "@/lib/costing/issue-line-values";
import { computeUnitCostsAt } from "@/lib/costing/unit-cost-at";
import { listIssueSlipsPage, type IssueSlipListFilters, type IssueSlipListPage } from "@/lib/stock/issue-slip-list";
import { buildIssueSlipDetail, type IssueSlipDetail } from "@/lib/stock/issue-slip-detail";
import { diffIssueSlipEdit, type EditDraftLine, type EditOriginalLine } from "@/lib/stock/issue-slip-edit-diff";
import {
  activeSlipLines, reversedIssueIds,
  type IssueRowRecord, type IssueSlipRecord, type StocktakeSessionRecord,
} from "@/lib/stock/issue-slip-status";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import {
  createIssueSlipAtomic,
  cancelIssueSlipAtomic,
  editIssueSlipAtomic,
  type SlipEditResult,
  type IssueSlipResult,
  type SlipCancelResult,
} from "@/lib/stock/manual-issue-transaction";
import { buildPackageLines, type PackageLine, type PurchasedItemConversion } from "@/lib/stock/stocktake-package-lines";
import { computeOnHandByPurchasedItem, filterByC17 } from "@/lib/stock/purchased-item-onhand";

const PATH = "/admin/inventory/issue-slips";

// Package lines per purchased item, one per active conversion -- shared by the
// create form and the slip detail so both offer the same units.
function groupPackageLines(
  conversions: any[],
  nameById: Map<string, string>,
  unitNameById: Map<string, string>,
): Map<string, PackageLine[]> {
  const input: PurchasedItemConversion[] = conversions.map(c => ({
    conversionId: c.id,
    purchasedItemId: c.purchased_item_id,
    purchasedItemName: nameById.get(c.purchased_item_id) ?? c.purchased_item_id,
    purchasedUnitName: unitNameById.get(c.purchased_unit) ?? c.purchased_unit ?? "",
    baseUnitName: unitNameById.get(c.base_unit) ?? c.base_unit ?? "",
    conversionRate: Number(c.conversion_rate),
    status: c.status,
    purchaseOnly: c.purchase_only === true,
  }));
  const byItem = new Map<string, PackageLine[]>();
  for (const line of buildPackageLines(input)) {
    const list = byItem.get(line.purchasedItemId) ?? [];
    list.push(line);
    byItem.set(line.purchasedItemId, list);
  }
  return byItem;
}

// Reads the tables the slip screens share and prices every issue line with the
// same costing engine as the Hàng đã xuất report (no second cost definition).
async function loadIssueSlipContext() {
  const [slips, issues, sessions, purchaseOrders, purchaseOrderLines, purchasedItems, itemCategories] = await Promise.all([
    findAllNoCache("Issue_Slips"),
    findAllNoCache("Stock_Issues"),
    findAllNoCache("stocktake_sessions"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAll("Purchased_Items"),
    findAll("Item_Categories"),
  ]);
  const purchases = buildIssueCostingPurchases(purchaseOrders as any[], purchaseOrderLines as any[]);
  const costed = selectCostedIssues(issues as any[], purchasedItems as any[], itemCategories as any[]);
  const costedIssues = costed.map((r: any) => ({
    id: r.id as string,
    purchased_item_id: r.purchased_item_id as string,
    at: r.issued_at as string,
    base_quantity: Number(r.base_quantity) || 0,
    source: r.source as "STOCKTAKE" | "MANUAL",
  }));
  const lineValues = computeIssueLineValues(purchases, costedIssues);
  return {
    slips: slips as IssueSlipRecord[],
    issues: issues as IssueRowRecord[],
    sessions: sessions as StocktakeSessionRecord[],
    items: (purchasedItems as any[]).map(p => ({ id: p.id as string, name: p.name as string })),
    lineValues,
    purchases,
    costedIssues,
  };
}

export async function getIssueSlipsPage(filters: IssueSlipListFilters): Promise<IssueSlipListPage> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const ctx = await loadIssueSlipContext();
  return listIssueSlipsPage({ ...ctx, filters });
}

export async function getIssueSlipDetail(slipId: string): Promise<IssueSlipDetail | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const ctx = await loadIssueSlipContext();
  const slip = ctx.slips.find(s => s.id === slipId);
  if (!slip) return null;

  const [conversions, units] = await Promise.all([findAll("UOM_Conversions"), findAll("Units")]);
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  const nameById = new Map(ctx.items.map(i => [i.id, i.name] as [string, string]));
  // Base unit: first ACTIVE conversion per item, as getIssuedValueReport does.
  const baseUnitNameByItem = new Map<string, string>();
  for (const c of conversions as any[]) {
    if (c.status !== "ACTIVE" || baseUnitNameByItem.has(c.purchased_item_id)) continue;
    baseUnitNameByItem.set(c.purchased_item_id, unitNameById.get(c.base_unit) ?? "");
  }
  // Price preview for the edit screen: every item the edit form offers plus
  // every item already on the slip, at the slip's own moment. Issues never
  // change the average, so it does not depend on the quantity being typed.
  const offered = await getIssueSlipFormData();
  const previewItemIds = new Set<string>(offered.map(o => o.id));
  for (const row of ctx.issues) if (row.issue_slip_id === slip.id) previewItemIds.add(row.purchased_item_id);
  const unitCostByItem = Object.fromEntries(
    computeUnitCostsAt(ctx.purchases, ctx.costedIssues, slip.issued_at, previewItemIds),
  );
  return buildIssueSlipDetail({
    slip,
    issues: ctx.issues,
    sessions: ctx.sessions,
    items: ctx.items,
    baseUnitNameByItem,
    packageLinesByItem: groupPackageLines(conversions as any[], nameById, unitNameById),
    lineValues: ctx.lineValues,
    unitCostByItem,
  });
}

// BR-INV-013. The server loads the slip's active lines itself; the client only
// sends its draft, so a stale or forged "original" can never be trusted.
export async function editIssueSlip(input: {
  slipId: string;
  draft: EditDraftLine[];
}): Promise<ActionResponse & { result?: SlipEditResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const issues = (await findAllNoCache("Stock_Issues")) as IssueRowRecord[];
    const active = activeSlipLines(input.slipId, issues, reversedIssueIds(issues));
    if (active.length === 0) return fail("Phiếu này đã huỷ hoặc không có dòng nào để sửa.");
    const original: EditOriginalLine[] = active.map(l => ({
      issueId: l.id,
      purchasedItemId: l.purchased_item_id,
      baseQuantity: Number(l.base_quantity),
    }));

    const diff = diffIssueSlipEdit(original, input.draft);
    if (!diff.ok) return fail(diff.error);

    const result = await editIssueSlipAtomic({
      slipId: input.slipId,
      removeIssueIds: diff.removeIssueIds,
      replaceIssueIds: diff.replaceIssueIds,
      addLines: diff.addLines,
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
    });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${input.slipId}`);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

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
  // the asset register (batch 3, 2026-08-22), never through a stock issue.
  // Deliberately not written as
  // a second, independent test: reusing system_type === "EQUIPMENT" means
  // the two screens can only ever agree or both be wrong the same way.
  const equipmentCategoryIds = new Set(
    (itemCategories as any[]).filter(c => c.system_type === "EQUIPMENT").map(c => c.id as string),
  );

  const packageLinesByPurchasedItem = groupPackageLines(conversions as any[], nameById, unitNameById);

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

// Read-only price preview for the create form: cost per base unit of every item
// the form offers, at the moment the operator picked. Same engine and context as
// getIssueSlipDetail (no second cost definition); an item with no cost at that
// moment is simply absent.
export async function getIssueUnitCostsAt(
  issuedAtIso: string,
): Promise<{ unitCostByItem: Record<string, number> } | { error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const issuedAt = new Date(issuedAtIso);
  if (Number.isNaN(issuedAt.getTime())) return { error: "Thời điểm xuất không hợp lệ" };

  try {
    const [offered, ctx] = await Promise.all([getIssueSlipFormData(), loadIssueSlipContext()]);
    const unitCostByItem = Object.fromEntries(
      computeUnitCostsAt(ctx.purchases, ctx.costedIssues, issuedAt.toISOString(), offered.map(o => o.id)),
    );
    return { unitCostByItem };
  } catch (error: unknown) {
    return { error: describeActionError(error).error ?? "Không tính được đơn giá" };
  }
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

// Plan D D14 / I11: cancel a WHOLE slip -- reverses every line not already
// individually reversed, in one call, one reason. Same requireAdmin() level
// as the other slip actions -- deliberately not raised to
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
    revalidatePath(`${PATH}/${input.slipId}`);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
