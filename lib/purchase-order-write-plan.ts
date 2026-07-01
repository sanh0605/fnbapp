import { randomUUID } from "node:crypto";
import {
  buildPurchaseReceipt,
  buildPurchaseReceiptLedgerEntry,
} from "@/lib/purchase-ledger-rebuild";

type PurchaseOrderWriteInput = {
  id: string;
  supplier_id: string;
  source_id: string;
  transaction_date: string;
  supplier_invoice_code: string;
  notes: string;
  subtotal_amount: number;
  shipping_fee: number;
  tax_amount: number;
  voucher_amount: number;
  discount_amount: number;
  total_amount: number;
  status: string;
  created_by_id: string;
  created_by_name: string;
};

type PurchaseOrderLineWriteInput = {
  purchased_item_id: string;
  unit: string;
  quantity: string | number;
  subtotal: string | number;
  conversion_id?: string;
  base_unit?: string;
};

type PurchasedItemWriteInput = {
  id: string;
  base_ingredient_id?: string;
};

type ConversionWriteInput = {
  id: string;
  purchased_item_id?: string;
  purchased_unit?: string;
  conversion_rate?: string | number;
};

export type PurchaseOrderWritePlan = {
  order: PurchaseOrderWriteInput;
  lines: Array<Record<string, unknown>>;
  ledgerRows: Array<Record<string, unknown>>;
};

export function buildPurchaseOrderWritePlan(input: {
  order: PurchaseOrderWriteInput;
  lines: PurchaseOrderLineWriteInput[];
  purchasedItems: PurchasedItemWriteInput[];
  conversions: ConversionWriteInput[];
  createdAt: string;
  idFactory?: () => string;
}): PurchaseOrderWritePlan {
  const idFactory = input.idFactory || randomUUID;
  const lineRows: Array<Record<string, unknown>> = [];
  const ledgerRows: Array<Record<string, unknown>> = [];

  for (const line of input.lines) {
    const isCompleted = input.order.status === "COMPLETED";
    const item = input.purchasedItems.find(
      candidate => candidate.id === line.purchased_item_id,
    );
    if (isCompleted && !item) {
      throw new Error(
        `Không tìm thấy hàng mua vào ${line.purchased_item_id}`,
      );
    }

    const receipt = isCompleted
      ? buildPurchaseReceipt({
          po: input.order,
          line,
          item: item!,
          conversions: input.conversions,
        })
      : null;
    const quantity = Number(line.quantity) || 0;
    const subtotal = Math.round(Number(line.subtotal) || 0);
    const draftConversion = !isCompleted && line.conversion_id
      ? input.conversions.find(
          candidate =>
            candidate.id === line.conversion_id &&
            candidate.purchased_item_id === line.purchased_item_id,
        )
      : null;
    const baseQuantity = receipt
      ? receipt.quantity_change
      : quantity * (Number(draftConversion?.conversion_rate) || 0);

    lineRows.push({
      id: `POL-${idFactory()}`,
      purchase_order_id: input.order.id,
      purchased_item_id: line.purchased_item_id,
      unit: line.unit,
      quantity,
      unit_price: quantity > 0 ? Math.round(subtotal / quantity) : 0,
      subtotal,
      conversion_id: line.conversion_id || receipt?.conversion_id || "",
      base_unit: line.base_unit || "",
      base_quantity: baseQuantity,
      created_at: input.createdAt,
    });

    if (receipt) {
      ledgerRows.push(
        buildPurchaseReceiptLedgerEntry(receipt, {
          id: `STK-${idFactory()}`,
          purchaseOrderId: input.order.id,
          createdAt: input.order.transaction_date,
        }),
      );
    }
  }

  return {
    order: input.order,
    lines: lineRows,
    ledgerRows,
  };
}
