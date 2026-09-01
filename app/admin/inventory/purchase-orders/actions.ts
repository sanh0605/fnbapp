"use server";

import { findAll, findById, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import type { DBPurchaseOrder, DBSupplier, DBPurchaseSource, DBPurchasedItem, DBItemCategory } from "@/types/db";
import { buildPurchaseOrderWritePlan } from "@/lib/purchase-order-write-plan";
import { savePurchaseOrderAtomic } from "@/lib/purchase-order-transaction";
import { requireAdmin } from "@/lib/auth";
import type { RawPurchaseOrderLine } from "@/lib/item-purchase-history";
import { planAssetsFromCompletedOrder, type EquipmentPurchaseLine } from "@/lib/asset-purchase-allocation";
import { toSaigonIsoString } from "@/lib/datetime";
import type { Band } from "@/lib/asset-depreciation";

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
    // docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md:
    // rethrow instead of a fabricated empty result -- app/error.tsx handles it.
    console.error("Loi getPurchaseOrdersData:", error);
    throw error;
  }
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

  // docs/superpowers/plans/2026-08-26-errors-the-owner-can-act-on.md
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
    if (id) {
      const [existingPo, existingLines] = await Promise.all([
        findById("Purchase_Orders", id),
        findAll("Purchase_Order_Lines") as Promise<RawPurchaseOrderLine[]>,
      ]);
      previousPo = existingPo;
      previousLineCount = existingLines.filter(
        (l: any) => l.po_id === id || l.purchase_order_id === id,
      ).length;
    }

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
      },
      lines,
      purchasedItems: purchasedItems as any[],
      conversions: conversions as any[],
      createdAt,
    });
    const saved = await savePurchaseOrderAtomic({
      order: writePlan.order,
      lines: writePlan.lines,
      replaceExisting: Boolean(id),
    });
    const po_id = saved.purchaseOrderId;

    // Batch 3, section 3.2 (docs/superpowers/plans/2026-08-22-batch-3-asset-register.md):
    // completing a NEW purchase order with an EQUIPMENT line creates the
    // corresponding assets row. purchase_order_line_id (nullable) plus the
    // complete absence of any "add asset" screen anywhere in the plan's
    // own section 5 are the only two things that say how an asset is ever
    // created -- this is the mechanism, inferred rather than stated
    // outright; flagged as such in the handoff.
    //
    // Deliberately scoped to a brand-new order only (!id): what should
    // happen to an already-created asset if its source purchase order is
    // later EDITED is not addressed anywhere in the plan, and silently
    // re-deriving or overwriting a depreciation record on every PO edit
    // risks corrupting term_months' freeze (section 9.1) or a disposal
    // history that already exists on that asset. Left as a known
    // limitation rather than guessed at.
    let assetWarning: string | undefined;
    if (!id && status === "COMPLETED") {
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
              // 2026-08-26 (docs/superpowers/plans/2026-08-26-equipment-needs-units.md):
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
