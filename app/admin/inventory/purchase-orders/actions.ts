"use server";

import { findAll, findAllNoCache, findById, insert, generateNewId, getCacheTag } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { findDuplicateActiveName } from "@/lib/shared/duplicate-name-guard";
import { parsePurchaseOrderPayment } from "@/lib/purchasing/purchase-order-payment";
import type { DBBankAccount, DBPurchaseOrder, DBSupplier, DBPurchaseSource, DBPurchasedItem, DBItemCategory } from "@/types/db";
import { buildPurchaseOrderWritePlan } from "@/lib/purchasing/purchase-order-write-plan";
import { savePurchaseOrderAtomic, type PurchaseOrderAssetsInput } from "@/lib/purchasing/purchase-order-transaction";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { listPurchaseOrdersPage, paymentLabelOf, type PurchaseOrderListFilters, type PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";
import type { RawPurchaseOrderLine } from "@/lib/purchasing/item-purchase-history";
import { planAssetsFromCompletedOrder, type EquipmentPurchaseLine } from "@/lib/assets/asset-purchase-allocation";
import { assetReconcileRefusalMessage, planAssetReconcile, type AssetReconcilePlan } from "@/lib/assets/asset-purchase-reconcile";
import { toSaigonIsoString, formatDateTimeFull } from "@/lib/shared/datetime";
import {
  describeCancelBlocker,
  validateCancelReason,
  type CancelAsset,
} from "@/lib/purchasing/purchase-order-cancel";
import {
  CancelFunctionMissingError,
  cancelPurchaseOrderAtomic,
  fetchPurchaseOrderCancelCheck,
} from "@/lib/purchasing/purchase-order-cancel-transaction";
import { buildPurchaseOrderCopySeed, type PurchaseOrderCopySeed } from "@/lib/purchasing/purchase-order-copy";
import type { Band } from "@/lib/assets/asset-depreciation";

const PATH = "/admin/inventory/purchase-orders";

export async function getPurchaseOrdersData(): Promise<{
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
  lines: RawPurchaseOrderLine[];
  items: DBPurchasedItem[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [orders, suppliers, lines, items] = await Promise.all([
      findAll("Purchase_Orders") as Promise<DBPurchaseOrder[]>,
      findAll("Suppliers") as Promise<DBSupplier[]>,
      findAll("Purchase_Order_Lines") as Promise<RawPurchaseOrderLine[]>,
      findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
    ]);
    return { orders, suppliers, lines, items };
  } catch (error) {
    // rethrow instead of a fabricated empty result -- app/error.tsx handles it.
    console.error("Loi getPurchaseOrdersData:", error);
    throw error;
  }
}

export async function getPurchaseOrdersPage(filters: PurchaseOrderListFilters): Promise<
  PurchaseOrderListPage & { suppliers: { id: string; name: string }[] }
> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [orders, suppliers, sources, lines, items] = await Promise.all([
    findAll("Purchase_Orders") as Promise<DBPurchaseOrder[]>,
    findAll("Suppliers") as Promise<DBSupplier[]>,
    findAll("Purchase_Sources") as Promise<DBPurchaseSource[]>,
    findAll("Purchase_Order_Lines") as Promise<RawPurchaseOrderLine[]>,
    findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
  ]);
  // Narrow the optional raw fields: a line missing either id cannot be searched by item name.
  const linkedLines = lines.flatMap(l =>
    l.purchase_order_id && l.purchased_item_id
      ? [{ purchase_order_id: l.purchase_order_id, purchased_item_id: l.purchased_item_id }]
      : []);
  const page = listPurchaseOrdersPage({ orders, suppliers, sources, lines: linkedLines, items, filters });
  const supplierOptions = suppliers
    .map(s => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return { ...page, suppliers: supplierOptions };
}

export async function savePurchaseOrder(formData: FormData): Promise<ActionResponse> {
  // Claude code — CODE-22: require ADMIN before PO write.
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const supplier_id = formData.get("supplier_id") as string;
  const transaction_date = formData.get("transaction_date") as string;
  const status = formData.get("status") as string; // DRAFT or COMPLETED
  const notes = formData.get("notes") as string;
  const source_id = formData.get("source_id") as string;
  const supplier_invoice_code = formData.get("supplier_invoice_code") as string;
  const linesJson = formData.get("lines_json") as string;
  // Override client-supplied created_by with authenticated actor (Claude code — UI-20 + CODE-22).
  const created_by = auth.actor.name;
  const id = formData.get("id") as string;
  
  const subtotal_amount = Number(formData.get("subtotal_amount") || 0);
  const shipping_fee = Number(formData.get("shipping_fee") || 0);
  const tax_amount = Number(formData.get("tax_amount") || 0);
  const voucher_amount = Number(formData.get("voucher_amount") || 0);
  const discount_amount = Number(formData.get("discount_amount") || 0);

  // Money columns are whole đồng and never below 0 (migration 0123 enforces it too).
  for (const [label, amount] of [
    ["Tổng tiền hàng", subtotal_amount],
    ["Phí vận chuyển", shipping_fee],
    ["Thuế", tax_amount],
    ["Voucher", voucher_amount],
    ["Chiết khấu", discount_amount],
  ] as const) {
    if (amount < 0) return fail(`${label} không được âm.`);
    if (!Number.isInteger(amount)) return fail(`${label} phải là số đồng nguyên.`);
  }

  const effectiveDate = transaction_date ? new Date(transaction_date).toISOString() : new Date().toISOString();

  // section 3: the client-side form validates this same field beside
  // supplier_id (PurchaseOrderForm.tsx's validatePurchaseOrderHeader) --
  // mirrored here so a request that reaches the server without going
  // through that form is refused the same way, not left to fail
  // downstream with no relation to what was actually missing.
  if (status === "COMPLETED" && (!supplier_id || !source_id || !linesJson || linesJson === "[]")) {
    return fail("Vui lòng nhập đầy đủ thông tin (nhà cung cấp, nguồn nhập và mặt hàng) để hoàn thành đơn");
  }

  try {
    const lines = JSON.parse(linesJson);

    const negativeIndex = lines.findIndex((line: { quantity?: string | number }) => Number(line.quantity) < 0);
    if (negativeIndex >= 0) return fail(`Dòng ${negativeIndex + 1}: Số lượng không được âm`);

    // BR-UI-009: the page stops an empty quantity, but a request can still
    // arrive without it. Refused before any write, in Vietnamese.
    if (status === "COMPLETED") {
      const emptyIndex = lines.findIndex(
        (line: { quantity?: string | number }) => !(Number(line.quantity) > 0),
      );
      if (emptyIndex >= 0) return fail(`Dòng ${emptyIndex + 1}: Vui lòng nhập số lượng`);
    }

    // PO-037 guard: the client computes subtotal_amount by summing the same line
    // rows it submits, so any disagreement means the payload is inconsistent and
    // must not be persisted. A header total with no lines behind it is exactly how
    // PO-037 came to show 3,571,000 against a single 102,000 line.
    if (status === "COMPLETED") {
      const lineSubtotalSum = lines.reduce(
        (sum: number, line: { subtotal?: string | number }) => sum + (Number(line.subtotal) || 0),
        0,
      );
      if (Math.abs(lineSubtotalSum - subtotal_amount) >= 1) {
        return fail(
          `Tổng tiền hàng (${subtotal_amount}) không khớp tổng các dòng hàng (${lineSubtotalSum}). Vui lòng kiểm tra lại danh sách mặt hàng.`,
        );
      }
    }

    const total_amount = subtotal_amount + shipping_fee + tax_amount - voucher_amount - discount_amount;
    if (total_amount < 0) return fail("Tổng tiền đơn không được âm. Kiểm tra lại chiết khấu và voucher.");
    const [purchasedItems, conversions, itemCategories] = await Promise.all([
      findAll("Purchased_Items"),
      findAll("UOM_Conversions"),
      findAll("Item_Categories"),
    ]);

    // Purchase orders have no edit history (unlike sales orders' order_events).
    // Read the pre-edit state now, before the atomic write replaces it, so the
    // trail row inserted below can record what changed.
    let previousPo: any = null;
    let previousLineCount = 0;
    // Stored lines of this order: an edit re-uses their ids (see write plan).
    let storedLines: Array<{ id: string; purchased_item_id: string }> = [];
    if (id) {
      const [existingPo, existingLines] = await Promise.all([
        findById("Purchase_Orders", id),
        findAllNoCache("Purchase_Order_Lines") as Promise<RawPurchaseOrderLine[]>,
      ]);
      previousPo = existingPo;
      // BR-INV-015: a cancelled order is never edited. Refused before any
      // write, asset or trail row (works before migration 0108 runs too).
      if (previousPo?.status === "CANCELLED") return fail("Phiếu đã huỷ, không sửa được");
      // Audit A8: requireAdmin lets MANAGER in; replacing a completed order
      // changes stock, cost and assets, so only the owner may do it. The page
      // already hides the edit button from MANAGER; this is the server check.
      if (previousPo?.status === "COMPLETED") {
        const owner = await requireOwner();
        if (!owner.ok) return fail(owner.error);
      }
      // BR-INV-015: a draft is not counted, so saving a completed order back as
      // a draft would be a cancel without the cancel's checks.
      if (previousPo?.status === "COMPLETED" && status === "DRAFT") {
        return fail("Phiếu đã hoàn thành không lưu nháp được. Muốn rút phiếu ra, dùng Huỷ phiếu.");
      }
      const ownLines = existingLines.filter(
        (l: any) => l.po_id === id || l.purchase_order_id === id,
      );
      previousLineCount = ownLines.length;
      storedLines = ownLines.flatMap((l: any) =>
        l.id && l.purchased_item_id ? [{ id: String(l.id), purchased_item_id: String(l.purchased_item_id) }] : []);
    }

    // BR-CATALOG-007: a stopped supplier or item is refused unless the stored order already names it.
    const keptItemIds = new Set(storedLines.map(l => l.purchased_item_id));
    const stoppedSupplier = ((await findAll("Suppliers")) as DBSupplier[]).find(
      s => s.id === supplier_id && s.status === "INACTIVE" && s.id !== previousPo?.supplier_id,
    );
    if (stoppedSupplier) return fail(`Nhà cung cấp ${stoppedSupplier.name} đã ngừng hợp tác.`);
    const stoppedItem = (purchasedItems as DBPurchasedItem[]).find(
      p => p.status === "INACTIVE" && !keptItemIds.has(p.id) && lines.some((l: { purchased_item_id?: string }) => l.purchased_item_id === p.id),
    );
    if (stoppedItem) return fail(`${stoppedItem.name} đã ngừng dùng.`);

    // How it was paid. A form that leaves the two fields out entirely (key
    // absent) keeps what the saved order has, so re-saving a completed order
    // never blanks its payment; a key that is present, even empty, is the
    // user's answer and is checked. Both fields are always sent below, because
    // the atomic function overwrites them on replace (migration 0107).
    const formHasPayment = formData.has("payment_method") || formData.has("bank_account_id");
    const keepSaved = Boolean(id) && previousPo !== null && !formHasPayment;
    const accounts = (await findAll("Bank_Accounts")) as DBBankAccount[];
    const payment = parsePurchaseOrderPayment({
      status,
      method: keepSaved ? previousPo.payment_method || "" : ((formData.get("payment_method") as string) || ""),
      bankAccountId: keepSaved ? previousPo.bank_account_id || "" : ((formData.get("bank_account_id") as string) || ""),
      activeAccountIds: accounts.filter(a => a.status === "ACTIVE").map(a => a.id),
      currentAccountId: previousPo?.bank_account_id ?? null,
    });
    if (payment.ok === false) return fail(payment.error);

    const createdAt = new Date().toISOString();
    const writePlan = buildPurchaseOrderWritePlan({
      order: {
        id: id || "",
        supplier_id,
        source_id,
        transaction_date: effectiveDate,
        supplier_invoice_code,
        notes,
        subtotal_amount,
        shipping_fee,
        tax_amount,
        voucher_amount,
        discount_amount,
        total_amount,
        status,
        created_by_id: auth.actor.id,
        created_by_name: created_by,
        payment_method: payment.value.payment_method,
        bank_account_id: payment.value.bank_account_id,
      },
      lines,
      purchasedItems: purchasedItems as any[],
      conversions: conversions as any[],
      createdAt,
      existingLines: storedLines,
    });
    const equipmentCategoryIds = new Set(
      (itemCategories as DBItemCategory[]).filter(c => c.system_type === "EQUIPMENT").map(c => c.id),
    );
    const purchasedItemById = new Map((purchasedItems as any[]).map(p => [p.id, p]));
    // 2026-08-26: base_quantity, not quantity -- quantity is in PURCHASE units
    // (e.g. "1 Combo 10"); base_quantity is already quantity * conversion_rate
    // (OPEN-ITEMS 56), or quantity itself when the item has no conversion.
    const buildEquipmentLines = (): EquipmentPurchaseLine[] =>
      writePlan.lines
        .filter((line: any) => {
          const item = purchasedItemById.get(line.purchased_item_id);
          return item && equipmentCategoryIds.has(item.item_category_id);
        })
        .map((line: any) => ({
          lineId: line.id as string,
          purchasedItemId: line.purchased_item_id as string,
          itemName: purchasedItemById.get(line.purchased_item_id)?.name || line.purchased_item_id,
          subtotal: Number(line.subtotal),
          baseQuantity: Number(line.base_quantity),
        }));
    // 2026-08-27 fix (OPEN-ITEMS 64): effectiveDate is a UTC string; slicing it
    // directly reads the UTC calendar day, one day early for a purchase
    // recorded at Saigon midnight. toSaigonIsoString converts first.
    const acquiredDate = toSaigonIsoString(new Date(effectiveDate)).slice(0, 10);
    // BR-COGS-008: an edit of a completed order is planned before anything is
    // written. A disposal on an asset the edit would change refuses it.
    let reconcilePlan: Extract<AssetReconcilePlan, { kind: "apply" }> | null = null;
    if (id && previousPo?.status === "COMPLETED" && status === "COMPLETED") {
      const [allAssets, disposals, reconcileBands] = await Promise.all([
        findAllNoCache("assets") as Promise<any[]>,
        findAllNoCache("asset_disposals") as Promise<any[]>,
        findAllNoCache("asset_depreciation_bands") as unknown as Promise<Band[]>,
      ]);
      const storedIds = new Set(storedLines.map(l => l.id));
      const result = planAssetReconcile({
        lines: writePlan.lines.map((line: any) => ({
          id: String(line.id),
          purchased_item_id: String(line.purchased_item_id),
          subtotal: Number(line.subtotal),
          base_quantity: Number(line.base_quantity),
        })),
        storedLineIds: storedLines.map(l => l.id),
        equipmentItemIds: new Set(
          (purchasedItems as any[]).filter(p => equipmentCategoryIds.has(p.item_category_id)).map(p => String(p.id)),
        ),
        itemNameById: new Map((purchasedItems as any[]).map(p => [String(p.id), String(p.name)])),
        assets: allAssets.filter(a => a.purchase_order_line_id && storedIds.has(String(a.purchase_order_line_id))),
        disposals,
        additions: shipping_fee + tax_amount,
        subtractions: voucher_amount + discount_amount,
        bands: reconcileBands,
        acquiredDate,
      });
      if (result.kind === "refuse") return fail(assetReconcileRefusalMessage(result.assets));
      reconcilePlan = result;
    }

    // Batch 3, section 3.2 + BR-COGS-008: assets follow the purchase, and (audit
    // A7) are written by the same database function as the order, so the two
    // commit or fail together.
    // - First completion (new order, or DRAFT -> COMPLETED): one asset per
    //   EQUIPMENT line.
    // - Edit of an already COMPLETED order (owner 2026-10-08, "1b"): the
    //   assets it created are retired / patched / added by planAssetReconcile,
    //   planned above BEFORE the save (a disposal refuses the edit with
    //   nothing written).
    // An id with no stored order found is skipped (status unknown, avoid
    // duplicate assets).
    const becomesCompletedNow =
      status === "COMPLETED" && (!id || (previousPo !== null && previousPo.status !== "COMPLETED"));
    let assets: PurchaseOrderAssetsInput | undefined;
    if (becomesCompletedNow) {
      const equipmentLines = buildEquipmentLines();
      if (equipmentLines.length > 0) {
        const bands = (await findAllNoCache("asset_depreciation_bands")) as unknown as Band[];
        // Throws (and so refuses the whole save) when an equipment line has no
        // usable quantity or no depreciation band for its price.
        const assetPlans = planAssetsFromCompletedOrder({
          allLines: writePlan.lines.map((line: any) => ({ lineId: line.id as string, subtotal: Number(line.subtotal) })),
          equipmentLines,
          additions: shipping_fee + tax_amount,
          subtractions: voucher_amount + discount_amount,
          bands,
        });
        assets = { create: assetPlans.map(plan => ({ ...plan, acquired_date: acquiredDate })), update: [], retire: [] };
      }
    }
    if (reconcilePlan) {
      const plan: Extract<AssetReconcilePlan, { kind: "apply" }> = reconcilePlan;
      if (plan.retire.length + plan.update.length + plan.create.length > 0) {
        assets = {
          create: plan.create.map(p => ({ ...p, acquired_date: acquiredDate })),
          update: plan.update,
          retire: plan.retire,
        };
      }
    }

    const saved = await savePurchaseOrderAtomic({
      order: writePlan.order,
      lines: writePlan.lines,
      replaceExisting: Boolean(id),
      ...(assets ? { assets } : {}),
    });
    const po_id = saved.purchaseOrderId;
    if (assets) {
      // The SQL write bypasses the insert()/update() helpers that used to drop
      // this 2-minute cache; without it the next edit plans from stale assets.
      revalidateTag(getCacheTag("assets"), { expire: 0 });
      revalidatePath("/admin/inventory/assets");
    }

    if (id && previousPo) {
      // The atomic save has already committed at this point. The edit trail is
      // observability, not correctness -- a failure here must never be reported
      // as a failed save, or the operator re-enters data that was in fact stored.
      try {
        const editId = await generateNewId("purchase_order_edits", "POE");
        await insert("purchase_order_edits", {
          id: editId,
          purchase_order_id: po_id,
          edited_by_id: auth.actor.id,
          edited_by_name: created_by,
          edited_at: new Date().toISOString(),
          previous_status: previousPo.status,
          previous_subtotal_amount: Number(previousPo.subtotal_amount) || 0,
          previous_line_count: previousLineCount,
          new_subtotal_amount: subtotal_amount,
          new_line_count: lines.length,
        });
      } catch (trailError: unknown) {
        console.error("purchase_order_edits trail write failed (save already committed):", trailError);
      }
    }

    revalidateTag("sheets-Purchase_Orders", { expire: 0 });
    revalidateTag("sheets-Purchase_Order_Lines", { expire: 0 });
    revalidatePath("/admin/inventory/purchase-orders");
    revalidatePath(`/admin/inventory/purchase-orders/${po_id}`);
    return ok({ po_id });
  } catch (error: unknown) {
    // The database raises this one in English.
    if (error instanceof Error && error.message.includes("already exists")) {
      return fail("Mã phiếu nhập này đã có rồi. Tải lại trang rồi lưu lại.");
    }
    return describeActionError(error);
  }
}

const CANCEL_MIGRATION_PENDING = "Chưa cập nhật dữ liệu, chưa huỷ được phiếu.";

export type PurchaseOrderCancelView =
  | { state: "missing-migration" }
  | { state: "not-found" }
  | {
      state: "ready";
      order: {
        id: string; dateText: string; supplierName: string; totalAmount: number; paymentLabel: string; status: string;
        subtotalAmount: number; shippingFee: number; taxAmount: number; discountTotal: number;
        invoiceCode: string; sourceName: string; notes: string;
      };
      lines: Array<{ id: string; itemName: string; unitName: string; quantity: number; unitPrice: number; subtotal: number }>;
      blockedMessages: string[];
      assets: CancelAsset[];
    };

// Everything the cancel page shows, from one read of the database check.
export async function getPurchaseOrderCancelView(id: string): Promise<PurchaseOrderCancelView> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const order = (await findById("Purchase_Orders", id)) as DBPurchaseOrder | null;
  if (!order) return { state: "not-found" };

  let check;
  try {
    check = await fetchPurchaseOrderCancelCheck(id);
  } catch (error) {
    if (error instanceof CancelFunctionMissingError) return { state: "missing-migration" };
    throw error;
  }
  const [supplier, allLines, allItems, allUnits, allSources] = await Promise.all([
    findById("Suppliers", order.supplier_id) as Promise<DBSupplier | null>,
    findAll("Purchase_Order_Lines") as Promise<any[]>,
    findAll("Purchased_Items") as Promise<any[]>,
    findAll("Units") as Promise<any[]>,
    findAll("Purchase_Sources") as Promise<any[]>,
  ]);
  // types/db.ts has stale money column names; read the real ones.
  const row = order as unknown as Record<string, unknown>;
  const num = (v: unknown) => Number(v) || 0;
  const lines = allLines
    .filter(l => l.purchase_order_id === id)
    .sort((a, b) => {
      const byTime = (a.created_at ?? "").localeCompare(b.created_at ?? "");
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    })
    .map(l => ({
      id: l.id as string,
      itemName: (allItems.find(i => i.id === l.purchased_item_id)?.name || l.purchased_item_id) as string,
      unitName: (allUnits.find(u => u.id === l.unit)?.name || l.unit) as string,
      quantity: num(l.quantity),
      unitPrice: num(l.unit_price),
      subtotal: num(l.subtotal),
    }));
  return {
    state: "ready",
    order: {
      id: order.id,
      dateText: formatDateTimeFull(order.transaction_date || order.created_at),
      supplierName: supplier?.name ?? "—",
      totalAmount: Number(order.total_amount) || 0,
      paymentLabel: paymentLabelOf(order.payment_method),
      status: order.status,
      subtotalAmount: num(row.subtotal_amount),
      shippingFee: num(row.shipping_fee),
      taxAmount: num(row.tax_amount),
      discountTotal: num(row.voucher_amount) + num(row.discount_amount),
      invoiceCode: order.supplier_invoice_code ?? "",
      sourceName: allSources.find(s => s.id === order.source_id)?.name ?? "—",
      notes: order.notes ?? "",
    },
    lines,
    blockedMessages: check.blocked.map(describeCancelBlocker),
    assets: check.assets,
  };
}

// Cancels a draft or completed order (BR-INV-015). The reason is checked here
// and again by the database function; the name written is the signed-in one.
export async function cancelPurchaseOrder(input: { id: string; reason: string }): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const reason = validateCancelReason(input.reason);
  if (reason.ok === false) return fail(reason.error);

  try {
    const outcome = await cancelPurchaseOrderAtomic({
      id: input.id,
      reason: reason.value,
      actorId: auth.actor.id,
      actorName: auth.actor.name,
    });
    if (outcome.cancelled === false) {
      return fail(outcome.blocked.map(describeCancelBlocker).join("\n"));
    }
    revalidateTag("sheets-Purchase_Orders", { expire: 0 });
    revalidateTag(getCacheTag("assets"), { expire: 0 });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${input.id}`);
    revalidatePath("/admin/inventory/assets");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports/pnl");
    return ok({ retiredAssetIds: outcome.retiredAssetIds });
  } catch (error: unknown) {
    if (error instanceof CancelFunctionMissingError) return fail(CANCEL_MIGRATION_PENDING);
    return describeActionError(error);
  }
}

// The starting values for a new order copied from this one (BR-INV-016).
// Read-only: nothing is written until the copy is saved through savePurchaseOrder.
export async function getPurchaseOrderCopySeed(id: string): Promise<PurchaseOrderCopySeed | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const order = (await findById("Purchase_Orders", id)) as DBPurchaseOrder | null;
  if (!order) return null;

  const [allLines, accounts] = await Promise.all([
    findAll("Purchase_Order_Lines") as Promise<any[]>,
    findAll("Bank_Accounts") as Promise<DBBankAccount[]>,
  ]);
  return buildPurchaseOrderCopySeed({
    order,
    lines: allLines.filter(l => l.purchase_order_id === id),
    activeBankAccountIds: new Set(accounts.filter(a => a.status === "ACTIVE").map(a => a.id)),
  });
}

export async function addPurchaseSource(name: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const trimmed = name.trim();
  if (!trimmed) return fail("Vui lòng nhập tên nguồn");
  if (trimmed.length > 100) return fail("Tên nguồn tối đa 100 ký tự");
  try {
    const existing = findDuplicateActiveName((await findAll("Purchase_Sources")) as DBPurchaseSource[], trimmed);
    if (existing) return ok({ data: { id: existing.id, name: existing.name } });

    const id = await generateNewId("Purchase_Sources", "SRC");
    await insert("Purchase_Sources", {
      id,
      name: trimmed,
      created_at: new Date().toISOString()
    });
    return ok({ data: { id, name: trimmed } });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
