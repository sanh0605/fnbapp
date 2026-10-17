"use server";

import { findAll, findAllNoCache, findAllWhere } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { loadStaffNameResolver } from "@/lib/auth/staff-names";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import {
  openStocktakeSessionAtomic,
  saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic,
  reverseStocktakeSessionAtomic,
  editConfirmedStocktakeAtomic,
  type StocktakeApplyResult,
  type StocktakeReversalResult,
} from "@/lib/stock/stocktake-transaction";
import { buildPackageLines, type PackageLine, type PurchasedItemConversion } from "@/lib/stock/stocktake-package-lines";
import { filterByC17 } from "@/lib/stock/purchased-item-onhand";
import { buildIssueCostingPurchases, selectCostedIssues } from "@/lib/costing/issue-costing-inputs";
import { computeIssueLineValues } from "@/lib/costing/issue-line-values";
import { computeUnitCostsAt } from "@/lib/costing/unit-cost-at";
import { displayMoney } from "@/lib/reports/display-rounding";

const PATH = "/admin/inventory/stocktake";

export interface StocktakeLineView {
  id: string;
  itemReference: string;
  itemName: string;
  unitName: string;
  countedQty: number | null;
  theoreticalAtCount: number | null;
  countedAt: string | null;
  // BR-INV-023: sealed packages typed per conversion id; null for lines never split (counted before 0137, or direct quantity).
  packageCounts: Record<string, number> | null;
  // Plan D D6: the purchased item's package conversions; empty when it has none.
  packageLines: PackageLine[];
  // Phân loại hàng name, for grouping.
  groupName: string;
  // BLANK = not counted (BR-INV-011), OFF = counted and different from the
  // book, MATCH = counted and equal. Derived on read, never stored.
  state: "BLANK" | "OFF" | "MATCH";
  // Cost per base unit now (exact); null when the item has no price yet.
  unitCost: number | null;
  // Counted - book in whole đồng, negative = short. OPEN: difference x unitCost
  // now (provisional). CONFIRMED: what the costing engine booked for the line.
  // REVERSED, uncounted, or no price: null.
  diffValue: number | null;
}

export interface StocktakeSessionView {
  id: string;
  status: "OPEN" | "CONFIRMED" | "REVERSED";
  createdByName: string;
  createdAt: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  lines: StocktakeLineView[];
}

async function loadItemNameMaps() {
  // base_ingredients dropped 2026-09-01
  // Verified live before removing: every stocktake_lines row in production
  // is item_type PURCHASED_ITEM (50/50) -- no BASE_INGREDIENT-type line has
  // ever existed, so there is no historical name this map needs to resolve
  // through that table.
  // semi_products dropped 2026-09-28 (migration 0105): the count list never
  // offered SEMI_PRODUCT lines (see actions.test.ts), so this map no longer
  // needs to read that table at all.
  const [purchasedItems, units, itemCategories, conversions] = await Promise.all([
    findAll("Purchased_Items"),
    findAll("Units"),
    findAll("Item_Categories"),
    findAll("UOM_Conversions"),
  ]);
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  // purchased_items.default_unit_id no longer exists (dropped by 0133); the unit is the
  // ACTIVE conversion's base unit, as on Phiếu xuất (lib/stock/item-stock-display.ts).
  const baseUnitIdByItem = new Map<string, string>();
  for (const c of conversions as any[]) {
    if (c.status === "ACTIVE") baseUnitIdByItem.set(c.purchased_item_id, c.base_unit);
  }
  const nameById = new Map<string, string>();
  const unitNameByItemId = new Map<string, string>();
  for (const item of purchasedItems as any[]) {
    nameById.set(item.id, item.name);
    unitNameByItemId.set(item.id, unitNameById.get(baseUnitIdByItem.get(item.id) ?? "") ?? "");
  }
  return {
    nameById,
    unitNameById,
    unitNameByItemId,
    purchasedItems: purchasedItems as any[],
    itemCategories: itemCategories as any[],
  };
}

// Plan D D6: one input per ACTIVE conversion (lib/stock/stocktake-package-lines.ts,
// D3), grouped under the purchased item that owns them. Built here, once,
// from the same UOM_Conversions table -- the screen must reuse this
// function's labels rather than growing a second label-generator: the same
// string produced two different ways is exactly the defect that broke
// section 9's own worked example earlier in this plan.
async function loadPackageLinesByPurchasedItem(
  nameById: Map<string, string>,
  unitNameById: Map<string, string>,
): Promise<Map<string, PackageLine[]>> {
  const conversions = (await findAll("UOM_Conversions")) as any[];

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

  const byPurchasedItem = new Map<string, PackageLine[]>();
  for (const line of buildPackageLines(input)) {
    const list = byPurchasedItem.get(line.purchasedItemId) ?? [];
    list.push(line);
    byPurchasedItem.set(line.purchasedItemId, list);
  }
  return byPurchasedItem;
}

// BR-INV-012: why the edit button is not offered. Checked in this order.
export type StocktakeEditBlock = "NOT_OWNER" | "NOT_CONFIRMED" | "NOT_LATEST" | "OPEN_SESSION";

export interface StocktakeDetailLine {
  id: string;
  itemReference: string;
  itemName: string;
  unitName: string;
  countedQty: number | null;
  theoreticalAtCount: number | null;
}

export interface StocktakeDetailView {
  id: string;
  status: "OPEN" | "CONFIRMED" | "REVERSED"; // the page redirects OPEN to /admin/inventory/stocktake
  createdByName: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  reversedAt: string | null;
  lines: StocktakeDetailLine[]; // sorted by itemName, "vi"
  editBlock: StocktakeEditBlock | null;
}

// One session with all its lines, for the read-only page and the owner's edit
// page. null only when the id is unknown.
export async function getStocktakeDetail(id: string): Promise<StocktakeDetailView | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [found, confirmed, open, lines, { nameById, unitNameByItemId }, staffName] = await Promise.all([
    findAllWhere<any>("stocktake_sessions", { eq: { id }, limit: 1 }),
    findAllWhere<any>("stocktake_sessions", { eq: { status: "CONFIRMED" } }),
    findAllWhere<any>("stocktake_sessions", { eq: { status: "OPEN" }, limit: 1 }),
    findAllWhere<any>("stocktake_lines", { eq: { session_id: id } }),
    loadItemNameMaps(),
    loadStaffNameResolver(),
  ]);
  const session = found[0];
  if (!session) return null;

  // findAllWhere cannot order by confirmed_at, so pick the latest here.
  const latestId = confirmed.reduce<any>(
    (best, s) => (!best || String(s.confirmed_at) > String(best.confirmed_at) ? s : best),
    null,
  )?.id;
  // Same owner rule as requireOwner(): ADMIN (or SYSTEM).
  const isOwner = auth.actor.role === "ADMIN" || auth.actor.role === "SYSTEM";
  const editBlock: StocktakeEditBlock | null = !isOwner ? "NOT_OWNER"
    : session.status !== "CONFIRMED" ? "NOT_CONFIRMED"
    : latestId !== session.id ? "NOT_LATEST"
    : open.length > 0 ? "OPEN_SESSION"
    : null;

  return {
    id: session.id,
    status: session.status,
    createdByName: staffName(session.created_by_name, session.created_by_id) ?? "",
    confirmedAt: session.confirmed_at ?? null,
    confirmedByName: staffName(session.confirmed_by_name, session.confirmed_by_id),
    reversedAt: session.reversed_at ?? null,
    lines: lines
      .map(line => ({
        id: line.id,
        itemReference: line.item_reference,
        itemName: nameById.get(line.item_reference) ?? line.item_reference,
        unitName: unitNameByItemId.get(line.item_reference) ?? "",
        countedQty: line.counted_qty !== null ? Number(line.counted_qty) : null,
        theoreticalAtCount: line.theoretical_at_count !== null ? Number(line.theoretical_at_count) : null,
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName, "vi")),
    editBlock,
  };
}

// Purchases and stock issues for the money columns, priced by the same costing
// engine as Phiếu xuất and the reports (no second cost definition).
async function loadStocktakeCosting() {
  const [issues, purchaseOrders, purchaseOrderLines, maps] = await Promise.all([
    findAllNoCache("Stock_Issues"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    loadItemNameMaps(),
  ]);
  const purchases = buildIssueCostingPurchases(purchaseOrders as any[], purchaseOrderLines as any[]);
  const costedIssues = selectCostedIssues(issues as any[], maps.purchasedItems, maps.itemCategories).map((r: any) => ({
    id: r.id as string,
    purchased_item_id: r.purchased_item_id as string,
    at: r.issued_at as string,
    base_quantity: Number(r.base_quantity) || 0,
    source: r.source as "STOCKTAKE" | "MANUAL",
  }));
  return { issues: issues as any[], purchases, costedIssues, maps };
}

// Value the engine booked for a session's stocktake rows, summed per item
// (positive = shortfall, negative = found goods: the sign of its row).
function bookedValueByItem(lineValues: Map<string, number>, issues: any[], sessionId: string) {
  const byItem = new Map<string, number>();
  for (const i of issues) {
    if (i.source !== "STOCKTAKE" || i.session_id !== sessionId || !lineValues.has(i.id)) continue;
    byItem.set(i.purchased_item_id, (byItem.get(i.purchased_item_id) ?? 0) + lineValues.get(i.id)!);
  }
  return byItem;
}

export interface StocktakeListRow {
  id: string;
  status: "OPEN" | "CONFIRMED" | "REVERSED";
  at: string; // confirmed time, or start time while counting
  personName: string;
  countedLines: number;
  totalLines: number;
  // Whole đồng, never netted against each other. OPEN: provisional (cost now);
  // CONFIRMED: booked by the engine; REVERSED: null.
  shortValue: number | null;
  foundValue: number | null;
  isLatestConfirmed: boolean;
}

// Every session, newest code first. Cancelled sessions do not exist (BR-INV-010).
export async function listStocktakeSessions(): Promise<StocktakeListRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [sessions, lines, { issues, purchases, costedIssues }, staffName] = await Promise.all([
    findAllNoCache("stocktake_sessions") as Promise<any[]>,
    findAllNoCache("stocktake_lines") as Promise<any[]>,
    loadStocktakeCosting(),
    loadStaffNameResolver(),
  ]);
  const lineValues = computeIssueLineValues(purchases, costedIssues);
  const unitCosts = computeUnitCostsAt(purchases, costedIssues, new Date().toISOString(), lines.map(l => l.item_reference));
  const latestConfirmed = sessions
    .filter(s => s.status === "CONFIRMED")
    .reduce<any>((best, s) => (!best || String(s.confirmed_at) > String(best.confirmed_at) ? s : best), null)?.id;

  return sessions
    .map((s): StocktakeListRow => {
      const own = lines.filter(l => l.session_id === s.id);
      let shortExact: number | null = null;
      let foundExact: number | null = null;
      if (s.status === "CONFIRMED") {
        const booked = [...bookedValueByItem(lineValues, issues, s.id).values()];
        shortExact = booked.filter(v => v > 0).reduce((a, b) => a + b, 0);
        foundExact = -booked.filter(v => v < 0).reduce((a, b) => a + b, 0);
      } else if (s.status === "OPEN") {
        shortExact = 0;
        foundExact = 0;
        for (const l of own) {
          if (l.counted_qty === null || l.theoretical_at_count === null) continue;
          const diff = (Number(l.counted_qty) - Number(l.theoretical_at_count)) * (unitCosts.get(l.item_reference) ?? 0);
          if (diff < 0) shortExact -= diff; else foundExact += diff;
        }
      }
      return {
        id: s.id,
        status: s.status,
        at: s.confirmed_at ?? s.created_at,
        personName: (s.confirmed_by_name
          ? staffName(s.confirmed_by_name, s.confirmed_by_id)
          : staffName(s.created_by_name, s.created_by_id)) ?? "",
        countedLines: own.filter(l => l.counted_qty !== null).length,
        totalLines: own.length,
        shortValue: shortExact === null ? null : displayMoney(shortExact),
        foundValue: foundExact === null ? null : displayMoney(foundExact),
        isLatestConfirmed: s.id === latestConfirmed,
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
}

// One session of any status, for the counting screen and the detail page.
// null only when the id is unknown.
export async function getStocktakeSessionData(id: string): Promise<StocktakeSessionView | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const session = (await findAllWhere<any>("stocktake_sessions", { eq: { id }, limit: 1 }))[0];
  if (!session) return null;

  const [lines, costing, staffName] = await Promise.all([
    findAllWhere<any>("stocktake_lines", { eq: { session_id: id } }),
    loadStocktakeCosting(),
    loadStaffNameResolver(),
  ]);
  const { nameById, unitNameById, unitNameByItemId, purchasedItems, itemCategories } = costing.maps;
  const packageLinesByPurchasedItem = await loadPackageLinesByPurchasedItem(nameById, unitNameById);
  const categoryNameById = new Map<string, string>(itemCategories.map(c => [c.id, c.name]));
  const categoryIdByItem = new Map<string, string>(purchasedItems.map(p => [p.id, p.item_category_id]));
  const unitCosts = computeUnitCostsAt(
    costing.purchases, costing.costedIssues, new Date().toISOString(), lines.map(l => l.item_reference),
  );
  const booked = session.status === "CONFIRMED"
    ? bookedValueByItem(computeIssueLineValues(costing.purchases, costing.costedIssues), costing.issues, id)
    : null;

  return {
    id: session.id,
    status: session.status,
    createdByName: staffName(session.created_by_name, session.created_by_id) ?? "",
    createdAt: session.created_at,
    confirmedAt: session.confirmed_at ?? null,
    confirmedByName: staffName(session.confirmed_by_name, session.confirmed_by_id),
    lines: lines
      .map((line): StocktakeLineView => {
        const counted = line.counted_qty !== null ? Number(line.counted_qty) : null;
        const book = line.theoretical_at_count !== null ? Number(line.theoretical_at_count) : null;
        const unitCost = unitCosts.get(line.item_reference) ?? null;
        let diffValue: number | null = null;
        if (counted !== null && book !== null && session.status === "OPEN" && unitCost !== null) {
          diffValue = displayMoney((counted - book) * unitCost);
        } else if (counted !== null && booked) {
          diffValue = displayMoney(-(booked.get(line.item_reference) ?? 0));
        }
        return {
          id: line.id,
          itemReference: line.item_reference,
          itemName: nameById.get(line.item_reference) ?? line.item_reference,
          unitName: unitNameByItemId.get(line.item_reference) ?? "",
          countedQty: counted,
          theoreticalAtCount: book,
          countedAt: line.counted_at,
          // package_counts is absent until 0137 runs; jsonb numbers may arrive as strings.
          packageCounts: line.package_counts
            ? Object.fromEntries(Object.entries(line.package_counts).map(([k, v]) => [k, Number(v)]))
            : null,
          packageLines: packageLinesByPurchasedItem.get(line.item_reference) ?? [],
          groupName: categoryNameById.get(categoryIdByItem.get(line.item_reference) ?? "") ?? "",
          state: counted === null ? "BLANK" : counted === book ? "MATCH" : "OFF",
          unitCost,
          diffValue,
        };
      })
      .sort((a, b) => a.groupName.localeCompare(b.groupName, "vi") || a.itemName.localeCompare(b.itemName, "vi")),
  };
}

// The database raises these two in English; turn them into what the owner can act on.
function describeStocktakeError(error: unknown): ActionResponse {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("plan changed")) return fail("Số liệu vừa thay đổi. Bấm Xem trước lại rồi xác nhận.");
  if (raw.includes("already open")) return fail("Đang có một phiếu kiểm kê mở. Xong hoặc huỷ phiếu đó rồi mới mở phiếu mới được.");
  return describeActionError(error);
}

export async function startStocktakeSession(): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const { purchasedItems, itemCategories } = await loadItemNameMaps();
    // 2026-08-26:
    // equipment is never stocktaken -- a fixed property of the EQUIPMENT
    // category (CLAUDE.md "Viết code"), not a per-item judgment. Excluding by
    // category rather than by is_non_inventory keeps that flag free for its
    // other meaning (the future batch-5 "mua dùng ngay" expense line,
    // OPEN-ITEMS 59): equipment must never be expensed on purchase, since it
    // is always depreciated instead, and ticking it per item would let the
    // two collide.
    const equipmentCategoryIds = new Set(
      itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id as string),
    );
    // Plan D Gap 1: a new session no longer offers BASE_INGREDIENT lines at
    // all. Counting by generic ingredient and counting by purchased item fed
    // different systems (stock_ledger vs stock_issues) with nothing on
    // screen telling them apart -- the owner chose purchased item (Plan D
    // section 3, decision 1). Semi-products carry no stock and no value
    // (BR-INV-006) and were never offered here.
    //
    // 2026-09-01:
    // used to also exclude an item whose linked base_ingredient was
    // flagged. Dropped, not replaced -- the 2026-08-31 change that moved the
    // non-inventory flag onto items had already put that flag onto
    // every affected item directly (SPM-005, SPM-052), so the item's own
    // flag below covers the same ground the group flag used to. Confirmed
    // live before removing: the eligible set is identical with or without
    // the group check, 69 items either way.
    const eligiblePurchasedItems = purchasedItems.filter(p => {
      const ownFlagged = p.is_non_inventory === true || p.is_non_inventory === "TRUE";
      const isEquipment = equipmentCategoryIds.has(p.item_category_id);
      return !ownFlagged && !isEquipment;
    });
    const includedPurchasedItems = await filterByC17(eligiblePurchasedItems);
    const items = includedPurchasedItems.map(p => ({
      itemReference: p.id as string,
    }));
    if (items.length === 0) return fail("Không có mặt hàng nào để kiểm kê");

    await openStocktakeSessionAtomic({
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
      items,
    });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeStocktakeError(error);
  }
}

// value: conversionId -> whole sealed packages, a base quantity, or null to clear the line (BR-INV-023).
export async function saveStocktakeLine(
  lineId: string,
  value: Record<string, number> | number | null,
): Promise<ActionResponse & { countedQty?: number | null; theoreticalAtCount?: number | null }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    let countedQty: number | null = null;
    let packageCounts: Record<string, number> | null = null;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) return fail("Số lượng phải là số không âm");
      countedQty = value;
    } else if (value && Object.keys(value).length > 0) {
      const line = (await findAllWhere<any>("stocktake_lines", { eq: { id: lineId }, limit: 1 }))[0];
      const conversions = ((await findAll("UOM_Conversions")) as any[]).filter(
        c => c.purchased_item_id === line?.item_reference && c.status === "ACTIVE" && c.purchase_only !== true,
      );
      countedQty = 0;
      for (const [conversionId, packages] of Object.entries(value)) {
        const conversion = conversions.find(c => c.id === conversionId);
        if (!conversion) return fail("Kiểu đóng gói không thuộc mặt hàng này");
        if (!Number.isInteger(packages) || packages < 0) return fail("Chỉ nhập số nguyên gói còn nguyên seal");
        countedQty += packages * Number(conversion.conversion_rate);
      }
      packageCounts = value;
    }
    const row = await saveStocktakeLineAtomic({ lineId, countedQty, packageCounts });
    const num = (v: unknown) => (v === null ? null : Number(v));
    return ok({ countedQty: num(row.counted_qty), theoreticalAtCount: num(row.theoretical_at_count) });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function cancelStocktakeSession(sessionId: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    await cancelStocktakeSessionAtomic(sessionId);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function getStocktakeConfirmPreview(
  sessionId: string,
): Promise<ActionResponse & { preview?: StocktakeApplyResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const preview = await applyStocktakeSessionAtomic({
      sessionId,
      confirmedById: auth.actor.id,
      confirmedByName: auth.actor.name,
      dryRun: true,
    });
    if (!preview.dryRun || preview.status !== "OPEN") {
      throw new Error("Stocktake preview did not return a dry run");
    }
    return ok({ preview });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function confirmStocktakeSession(
  sessionId: string,
  expectedPlanHash: string,
): Promise<ActionResponse & { result?: StocktakeApplyResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!expectedPlanHash.trim()) {
    return fail("Cần xem trước rồi mới xác nhận được. Bấm Xem trước lại.");
  }

  try {
    const result = await applyStocktakeSessionAtomic({
      sessionId,
      confirmedById: auth.actor.id,
      confirmedByName: auth.actor.name,
      dryRun: false,
      expectedPlanHash,
    });
    if (result.dryRun || result.status !== "CONFIRMED") {
      throw new Error("Stocktake confirmation did not apply the session");
    }
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeStocktakeError(error);
  }
}

// BR-INV-012: owner edits counted quantities of the most recent confirmed
// stocktake. Lines with unchanged numbers may be sent; the database skips them.
export async function editConfirmedStocktake(
  sessionId: string,
  lines: Array<{ lineId: string; countedQty: number }>,
): Promise<ActionResponse & { changedCount?: number }> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);
  if (lines.length === 0) return fail("Không có dòng nào để sửa");
  if (lines.some(l => !Number.isFinite(l.countedQty) || l.countedQty < 0)) {
    return fail("Số đếm phải là số không âm");
  }

  try {
    const result = await editConfirmedStocktakeAtomic({ sessionId, lines });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${sessionId}`);
    revalidatePath("/admin/inventory/issue-slips");
    return ok({ changedCount: result.changedCount });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// Plan D D14, U1-U6: undo a confirmed stocktake session. Owner-only
// (requireOwner, not requireAdmin) -- the one action in the system stricter
// than the usual ADMIN+MANAGER guard, because this is the check on the
// person who counted.
export async function reverseConfirmedStocktakeSession(
  sessionId: string,
  reason: string,
): Promise<ActionResponse & { result?: StocktakeReversalResult }> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);
  if (!reason.trim()) {
    return fail("Lý do huỷ phiên kiểm kê là bắt buộc");
  }

  try {
    const result = await reverseStocktakeSessionAtomic({
      sessionId,
      reason: reason.trim(),
      reversedById: auth.actor.id,
      reversedByName: auth.actor.name,
    });
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
