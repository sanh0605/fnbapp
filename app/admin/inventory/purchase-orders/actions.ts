"use server";

import { findAll, insert, insertMany, update, generateNewId, remove, removeMany } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPurchaseOrder, DBSupplier, DBPurchaseSource } from "@/types/db";
import { buildPurchaseReceipt } from "@/lib/purchase-ledger-rebuild";
import { requireAdmin } from "@/lib/auth";

const PATH = "/admin/inventory/purchase-orders";

export async function getPurchaseOrdersData(): Promise<{
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
}> {
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

    // First pass: UOM_Conversions logic was removed because conversions are now pre-defined in Purchased_Item

    // 1. Create or Update Purchase Order
    let po_id = id;
    if (po_id) {
      await update("Purchase_Orders", po_id, {
        supplier_id,
        status,
        total_amount,
        subtotal_amount,
        shipping_fee,
        tax_amount,
        voucher_amount,
        discount_amount,
        notes,
        transaction_date: effectiveDate,
        source_id,
        supplier_invoice_code,
      });

      // Claude code — CODE-9: batch remove để tránh fail-between mất dữ liệu.
      // Trước đây loop remove từng row; nếu fail giữa chừng → trạng thái nửa xóa.
      const existingLines = await findAll("Purchase_Order_Lines");
      const oldLineIds = existingLines.filter((l:any) => l.po_id === po_id).map((l:any) => l.id);
      if (oldLineIds.length > 0) {
        await removeMany("Purchase_Order_Lines", oldLineIds);
      }

      // [P0 FIX] Xoá các bản ghi Stock_Ledger cũ liên quan đến PO này
      // để tránh tồn kho bị cộng trùng khi sửa lại đơn đã COMPLETED
      const existingLedger = await findAll("Stock_Ledger");
      const oldLedgerIds = existingLedger
        .filter((e: any) => e.reference_id === po_id && e.transaction_type === "PO_RECEIPT")
        .map((e: any) => e.id);
      if (oldLedgerIds.length > 0) {
        await removeMany("Stock_Ledger", oldLedgerIds);
      }
    } else {
      po_id = await generateNewId("Purchase_Orders", "PO");
      await insert("Purchase_Orders", {
        id: po_id,
        supplier_id,
        status,
        total_amount,
        subtotal_amount,
        shipping_fee,
        tax_amount,
        voucher_amount,
        discount_amount,
        notes,
        created_by_name: created_by,
        created_by_id: auth.actor.id,
        transaction_date: effectiveDate,
        source_id,
        supplier_invoice_code,
        created_at: new Date().toISOString()
      });
    }

    // 2. Create PO Lines & Stock Ledger — Claude code — CODE-9/CODE-15: accumulate + batch insert.
    const lineRows: any[] = [];
    const ledgerRows: any[] = [];
    for (const line of lines) {
      const line_id = await generateNewId("Purchase_Order_Lines", "POL");
      const line_subtotal = Number(line.subtotal);

      // Calculate unit price backwards
      const unit_price = Number(line.quantity) > 0 ? line_subtotal / Number(line.quantity) : 0;

      lineRows.push({
        id: line_id,
        po_id,
        purchased_item_id: line.purchased_item_id,
        unit: line.unit,
        quantity: line.quantity,
        unit_price: unit_price,
        subtotal: line_subtotal,
        conversion_id: line.conversion_id || "",
      });

      if (status === "COMPLETED") {
        const ledger_id = await generateNewId("Stock_Ledger", "STK");
        const item = (purchasedItems as any[]).find((p: any) => p.id === line.purchased_item_id);
        if (!item) {
          throw new Error(`Không tìm thấy hàng mua vào ${line.purchased_item_id}`);
        }
        const receipt = buildPurchaseReceipt({
          po: {
            id: po_id,
            subtotal_amount,
            shipping_fee,
            tax_amount,
            voucher_amount,
            discount_amount,
          },
          line,
          item,
          conversions: conversions as any[],
        });

        ledgerRows.push({
          id: ledger_id,
          transaction_type: "PO_RECEIPT",
          reference_id: po_id,
          item_reference: receipt.item_reference,
          quantity_change: receipt.quantity_change,
          unit_cost: receipt.unit_cost,
          created_at: effectiveDate,
        });
      }
    }

    if (lineRows.length > 0) await insertMany("Purchase_Order_Lines", lineRows);
    if (ledgerRows.length > 0) await insertMany("Stock_Ledger", ledgerRows);

    revalidatePath("/admin/inventory/purchase-orders");
    revalidatePath(`/admin/inventory/purchase-orders/${po_id}`);
    return ok({ po_id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function addPurchaseSource(name: string): Promise<ActionResponse> {
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
