"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPurchaseOrder, DBSupplier, DBPurchaseSource } from "@/types/db";
import { buildPurchaseOrderWritePlan } from "@/lib/purchase-order-write-plan";
import { savePurchaseOrderAtomic } from "@/lib/purchase-order-transaction";
import { requireAdmin } from "@/lib/auth";

const PATH = "/admin/inventory/purchase-orders";

export async function getPurchaseOrdersData(): Promise<{
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [orders, suppliers] = await Promise.all([
      findAll("Purchase_Orders") as Promise<DBPurchaseOrder[]>,
      findAll("Suppliers") as Promise<DBSupplier[]>,
    ]);
    return { orders, suppliers };
  } catch (error) {
    console.error("Loi getPurchaseOrdersData:", error);
    return { orders: [], suppliers: [] };
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

  if (status === "COMPLETED" && (!supplier_id || !linesJson || linesJson === "[]")) {
    return fail("Vui lòng nhập đầy đủ thông tin (nhà cung cấp và mặt hàng) để hoàn thành đơn");
  }

  try {
    const lines = JSON.parse(linesJson);
    const total_amount = subtotal_amount + shipping_fee + tax_amount - voucher_amount - discount_amount;
    const [purchasedItems, conversions] = await Promise.all([
      findAll("Purchased_Items"),
      findAll("UOM_Conversions"),
    ]);

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
      ledgerRows: writePlan.ledgerRows,
      replaceExisting: Boolean(id),
    });
    const po_id = saved.purchaseOrderId;

    revalidateTag("sheets-Purchase_Orders");
    revalidateTag("sheets-Purchase_Order_Lines");
    revalidateTag("sheets-Stock_Ledger");
    revalidatePath("/admin/inventory/purchase-orders");
    revalidatePath(`/admin/inventory/purchase-orders/${po_id}`);
    return ok({ po_id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
