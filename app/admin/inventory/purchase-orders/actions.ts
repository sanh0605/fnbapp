"use server";

import { findAll, findById, insert, update, generateNewId } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { parsePurchaseOrderPayment } from "@/lib/purchasing/purchase-order-payment";
import type { DBBankAccount, DBPurchaseOrder, DBSupplier, DBPurchaseSource, DBPurchasedItem, DBItemCategory } from "@/types/db";
import { buildPurchaseOrderWritePlan } from "@/lib/purchasing/purchase-order-write-plan";
import { savePurchaseOrderAtomic } from "@/lib/purchasing/purchase-order-transaction";
import { requireAdmin } from "@/lib/auth/auth";
import { listPurchaseOrdersPage, paymentLabelOf, type PurchaseOrderListFilters, type PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";
import type { RawPurchaseOrderLine } from "@/lib/purchasing/item-purchase-history";
import { planAssetsFromCompletedOrder, type EquipmentPurchaseLine } from "@/lib/assets/asset-purchase-allocation";
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
        findAll("Purchase_Order_Lines") as Promise<RawPurchaseOrderLine[]>,
      ]);
      previousPo = existingPo;
      // BR-INV-015: a cancelled order is never edited. Refused before any
      // write, asset or trail row (works before migration 0108 runs too).
      if (previousPo?.status === "CANCELLED") return fail("Phiếu đã huỷ, không sửa được");
      const ownLines = existingLines.filter(
        (l: any) => l.po_id === id || l.purchase_order_id === id,
      );
      previousLineCount = ownLines.length;
      storedLines = ownLines.flatMap((l: any) =>
        l.id && l.purchased_item_id ? [{ id: String(l.id), purchased_item_id: String(l.purchased_item_id) }] : []);
    }

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
    const saved = await savePurchaseOrderAtomic({
      order: writePlan.order,
      lines: writePlan.lines,
      replaceExisting: Boolean(id),
    });
    const po_id = saved.purchaseOrderId;

    // Batch 3, section 3.2:
    // completing a NEW purchase order with an EQUIPMENT line creates the
    // corresponding assets row. purchase_order_line_id (nullable) plus the
    // complete absence of any "add asset" screen anywhere in the plan's
    // own section 5 are the only two things that say how an asset is ever
    // created -- this is the mechanism, inferred rather than stated
    // outright; flagged as such in the handoff.
    //
    // Assets are created the first time an order becomes COMPLETED: either
    // brand new (!id) or an existing order whose stored status, read above
    // before the atomic save replaced it, was not COMPLETED (DRAFT ->
    // COMPLETED). Still open and deliberately NOT handled: editing an
    // order that was ALREADY completed. What should happen to an
    // already-created asset then is an undecided owner question, and
    // silently re-deriving or overwriting a depreciation record on every
    // PO edit risks corrupting term_months' freeze (section 9.1) or a
    // disposal history that already exists on that asset. Left as a known
    // limitation rather than guessed at. An id with no stored order found
    // is also skipped (status unknown, avoid duplicate assets).
    const becomesCompletedNow =
      status === "COMPLETED" && (!id || (previousPo !== null && previousPo.status !== "COMPLETED"));
    let assetWarning: string | undefined;
    if (becomesCompletedNow) {
      try {
        const equipmentCategoryIds = new Set(
          (itemCategories as DBItemCategory[])
            .filter(c => c.system_type === "EQUIPMENT")
            .map(c => c.id),
        );
        const purchasedItemById = new Map((purchasedItems as any[]).map(p => [p.id, p]));
        const equipmentLines: EquipmentPurchaseLine[] = writePlan.lines
          .filter((line: any) => {
            const item = purchasedItemById.get(line.purchased_item_id);
            return item && equipmentCategoryIds.has(item.item_category_id);
          })
          .map((line: any) => {
            const item = purchasedItemById.get(line.purchased_item_id);
            return {
              lineId: line.id as string,
              purchasedItemId: line.purchased_item_id as string,
              itemName: item?.name || line.purchased_item_id,
              subtotal: Number(line.subtotal),
              // 2026-08-26:
              // base_quantity, not quantity -- quantity is in PURCHASE units
              // (e.g. "1 Combo 10"), base_quantity is already correctly
              // computed by buildPurchaseOrderWritePlan/buildPurchaseReceipt
              // (OPEN-ITEMS 56) as quantity * conversion_rate, or quantity
              // itself when the item has no conversion at all.
              baseQuantity: Number(line.base_quantity),
            };
          });

        if (equipmentLines.length > 0) {
          const bands = (await findAll("asset_depreciation_bands")) as unknown as Band[];
          const assetPlans = planAssetsFromCompletedOrder({
            allLines: writePlan.lines.map((line: any) => ({ lineId: line.id as string, subtotal: Number(line.subtotal) })),
            equipmentLines,
            additions: shipping_fee + tax_amount,
            subtractions: voucher_amount + discount_amount,
            bands,
          });
          for (const plan of assetPlans) {
            const assetId = await generateNewId("assets", "TS");
            await insert("assets", {
              id: assetId,
              purchased_item_id: plan.purchased_item_id,
              purchase_order_line_id: plan.purchase_order_line_id,
              name_snapshot: plan.name_snapshot,
              // 2026-08-27 fix (OPEN-ITEMS 64): effectiveDate is a UTC
              // string; slicing it directly reads the UTC calendar day,
              // one day early for a purchase recorded at Saigon midnight.
              // toSaigonIsoString converts to Saigon wall-clock first.
              acquired_date: toSaigonIsoString(new Date(effectiveDate)).slice(0, 10),
              unit_cost: plan.unit_cost,
              total_cost: plan.total_cost,
              quantity: plan.quantity,
              term_months: plan.term_months,
            });
          }
          revalidatePath("/admin/inventory/assets");
        }
      } catch (assetError: unknown) {
        // The PO itself already committed -- do not report the whole save
        // as failed for this (same reasoning as the edit-trail write
        // below). Surfaced as a warning instead of swallowed silently,
        // since an un-created asset means real equipment goes untracked.
        console.error("Asset creation failed (purchase order already saved):", assetError);
        assetWarning = assetError instanceof Error
          ? assetError.message
          : "Không tạo được tài sản cho dụng cụ trong đơn này";
      }
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

    revalidateTag("sheets-Purchase_Orders");
    revalidateTag("sheets-Purchase_Order_Lines");
    revalidatePath("/admin/inventory/purchase-orders");
    revalidatePath(`/admin/inventory/purchase-orders/${po_id}`);
    return ok({ po_id, ...(assetWarning ? { assetWarning } : {}) });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// Changes only how a COMPLETED order was paid: lines, amounts, stock and the
// asset register do not read these two columns (spec section 7).
export async function setPurchaseOrderPayment(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return fail("Thiếu mã phiếu nhập");

  try {
    const existing = (await findById("Purchase_Orders", id)) as DBPurchaseOrder | null;
    if (!existing) return fail("Không tìm thấy phiếu nhập");
    if (existing.status === "DRAFT") return fail("Phiếu nháp: chọn cách trả trong phiếu");
    if (existing.status !== "COMPLETED") return fail("Chỉ phiếu đã hoàn thành mới đổi được cách trả");

    const accounts = (await findAll("Bank_Accounts")) as DBBankAccount[];
    const payment = parsePurchaseOrderPayment({
      status: "COMPLETED",
      method: ((formData.get("payment_method") as string) || "").trim(),
      bankAccountId: ((formData.get("bank_account_id") as string) || "").trim(),
      activeAccountIds: accounts.filter(a => a.status === "ACTIVE").map(a => a.id),
      currentAccountId: existing.bank_account_id ?? null,
    });
    if (payment.ok === false) return fail(payment.error);

    await update("Purchase_Orders", id, {
      payment_method: payment.value.payment_method,
      bank_account_id: payment.value.bank_account_id,
    });
    revalidateTag("sheets-Purchase_Orders");
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${id}`);
    revalidatePath("/admin/finance");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

const CANCEL_MIGRATION_PENDING = "Chưa cập nhật dữ liệu, chưa huỷ được phiếu.";

export type PurchaseOrderCancelView =
  | { state: "missing-migration" }
  | { state: "not-found" }
  | {
      state: "ready";
      order: { id: string; dateText: string; supplierName: string; totalAmount: number; paymentLabel: string; status: string };
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
  const supplier = (await findById("Suppliers", order.supplier_id)) as DBSupplier | null;
  return {
    state: "ready",
    order: {
      id: order.id,
      dateText: formatDateTimeFull(order.transaction_date || order.created_at),
      supplierName: supplier?.name ?? "—",
      totalAmount: Number(order.total_amount) || 0,
      paymentLabel: paymentLabelOf(order.payment_method),
      status: order.status,
    },
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
    revalidateTag("sheets-Purchase_Orders");
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

export async function addPurchaseSource(name: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  if (!name) return fail("Vui lòng nhập tên nguồn");
  try {
    const id = await generateNewId("Purchase_Sources", "SRC");
    await insert("Purchase_Sources", {
      id,
      name,
      created_at: new Date().toISOString()
    });
    return ok({ id });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
