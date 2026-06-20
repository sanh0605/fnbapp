"use server";

import { findAll, insert, update, generateNewId, remove } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPurchaseOrder, DBSupplier, DBPurchaseSource } from "@/types/db";

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
  const supplier_id = formData.get("supplier_id") as string;
  const transaction_date = formData.get("transaction_date") as string;
  const status = formData.get("status") as string; // DRAFT or COMPLETED
  const notes = formData.get("notes") as string;
  const source_id = formData.get("source_id") as string;
  const supplier_invoice_code = formData.get("supplier_invoice_code") as string;
  const linesJson = formData.get("lines_json") as string;
  const created_by = formData.get("created_by") as string; 
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
    const total_extra_costs = shipping_fee + tax_amount - voucher_amount - discount_amount;

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

      // Xoá các dòng cũ
      const existingLines = await findAll("Purchase_Order_Lines");
      const oldLines = existingLines.filter((l:any) => l.po_id === po_id);
      for (const oldLine of oldLines) {
        await remove("Purchase_Order_Lines", oldLine.id);
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
        created_by,
        transaction_date: effectiveDate,
        source_id,
        supplier_invoice_code,
        created_at: new Date().toISOString()
      });
    }

    // 2. Create PO Lines & Stock Ledger
    for (const line of lines) {
      const line_id = await generateNewId("Purchase_Order_Lines", "POL");
      const line_subtotal = Number(line.subtotal);
      
      // Calculate unit price backwards
      const unit_price = Number(line.quantity) > 0 ? line_subtotal / Number(line.quantity) : 0;
      
      await insert("Purchase_Order_Lines", {
        id: line_id,
        po_id,
        purchased_item_id: line.purchased_item_id,
        unit: line.unit,
        quantity: line.quantity,
        unit_price: unit_price,
        subtotal: line_subtotal
      });

      if (status === "COMPLETED") {
        const ledger_id = await generateNewId("Stock_Ledger", "STK");
        
        let quantity_change = Number(line.quantity);
        let item_reference = line.purchased_item_id;

        // If it's a RAW item
        if (line.base_ingredient_id) {
           item_reference = line.base_ingredient_id;
           let convRate = line.conversion_rate;
           if (convRate) {
              quantity_change = quantity_change * Number(convRate);
           }
        }

        // Landed cost allocation
        let allocated_extra = 0;
        if (subtotal_amount > 0) {
           const line_proportion = line_subtotal / subtotal_amount;
           allocated_extra = total_extra_costs * line_proportion;
        }
        
        const landed_cost_total = line_subtotal + allocated_extra;
        const unit_cost = quantity_change > 0 ? landed_cost_total / quantity_change : 0;

        await insert("Stock_Ledger", {
           id: ledger_id,
           transaction_type: "PO_RECEIPT",
           reference_id: po_id,
           item_reference,
           quantity_change,
           unit_cost,
           created_at: effectiveDate
        });
      }
    }

    revalidatePath("/admin/inventory/purchase-orders");
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
