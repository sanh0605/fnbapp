import { NextResponse } from "next/server";
import { findAllNoCache } from "@/lib/sheets_db";
import { auditOrderLedger } from "@/lib/order-ledger-audit";

export async function GET() {
  try {
    const [orders, orderLines, stockLedger, baseIngredients, semiProducts] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAllNoCache("Stock_Ledger"),
      findAllNoCache("Base_Ingredients"),
      findAllNoCache("Semi_Products"),
    ]);

    const nameMap: Record<string, string> = {};
    for (const item of [...(baseIngredients as any[]), ...(semiProducts as any[])]) {
      nameMap[item.id] = item.name || item.id;
    }

    const orderById = new Map((orders as any[]).map(order => [order.id, order]));
    const grouped = new Map<string, any>();
    const report = auditOrderLedger({
      orders: orders as any[],
      lines: orderLines as any[],
      ledger: stockLedger as any[],
    });

    for (const mismatch of report.mismatches) {
      const order = orderById.get(mismatch.order_id) || {};
      if (!grouped.has(mismatch.order_id)) {
        grouped.set(mismatch.order_id, {
          order_id: mismatch.order_id,
          order_no: mismatch.order_no,
          created_at: order.created_at || "",
          diffs: [],
        });
      }

      grouped.get(mismatch.order_id).diffs.push({
        id: mismatch.item_reference,
        name: nameMap[mismatch.item_reference] || mismatch.item_reference,
        expected: mismatch.expected_quantity,
        actual: mismatch.actual_quantity,
      });
    }

    return NextResponse.json({
      discrepancies: [...grouped.values()],
      orphanLedgerRows: report.orphanLedgerRows.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
