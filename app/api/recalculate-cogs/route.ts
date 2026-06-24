import { NextResponse } from "next/server";
import { findAllNoCache, getSheetsClient } from "@/lib/sheets_db";
import { computeLineCostFIFO } from "@/lib/order-cogs-fifo";
import { FIFOTracker } from "@/lib/fifo-tracker";
import { parseLineRecipeSnapshot } from "@/lib/order-types";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function getColName(index: number) {
  let colName = '';
  let temp = index;
  while (temp >= 0) {
    colName = String.fromCharCode(65 + (temp % 26)) + colName;
    temp = Math.floor(temp / 26) - 1;
  }
  return colName;
}

export async function POST() {
  try {
    const [orders, orderLines, recipes, semiProducts, ledger] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAllNoCache("Recipes"),
      findAllNoCache("Semi_Products"),
      findAllNoCache("Stock_Ledger"),
    ]);

    const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT");
    const spYields = new Map<string, number>();
    for (const sp of semiProducts as any[]) {
      spYields.set(sp.id, Number(sp.batch_yield) || 1);
    }
    const spContext = { recipes: spRecipes, yields: spYields };

    // Build order map for sale time lookup
    const orderMap = new Map<string, any>();
    for (const o of orders as any[]) orderMap.set(o.id, o);

    // Sort lines by order created_at to apply FIFO properly
    const sortedLines = [...(orderLines as any[])].sort((a, b) => {
      const oa = orderMap.get(a.order_id);
      const ob = orderMap.get(b.order_id);
      const ta = oa?.created_at ? new Date(oa.created_at).getTime() : 0;
      const tb = ob?.created_at ? new Date(ob.created_at).getTime() : 0;
      return ta - tb;
    });

    const fifoTracker = new FIFOTracker();
    fifoTracker.init(ledger);

    const updates = [];
    let updatedCount = 0;

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Order_Lines_V2!A1:ZZ`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ success: true, updatedCount: 0 });
    
    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    const costAtSaleIndex = headers.indexOf('cost_at_sale');
    
    if (idIndex === -1 || costAtSaleIndex === -1) {
      throw new Error("Missing necessary columns in Order_Lines_V2");
    }

    const costAtSaleColName = getColName(costAtSaleIndex);

    // Map line id to row index (1-based)
    const rowIdxMap = new Map<string, number>();
    for (let i = 1; i < rows.length; i++) {
      rowIdxMap.set(rows[i][idIndex], i + 1); // +1 because Google Sheets is 1-indexed
    }

    for (const line of sortedLines) {
      // Ignore cancelled or non-completed orders
      const order = orderMap.get(line.order_id);
      if (order?.status !== "COMPLETED") continue;

      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const newCost = computeLineCostFIFO(lineRecipe, fifoTracker, Number(line.qty) || 0, spContext);
      
      const currentCost = Number(line.cost_at_sale) || 0;
      if (Math.abs(newCost - currentCost) > 0.01) { // If changed
        const rowNum = rowIdxMap.get(line.id);
        if (rowNum) {
          updates.push({
            range: `Order_Lines_V2!${costAtSaleColName}${rowNum}`,
            values: [[newCost]]
          });
          updatedCount++;
        }
      }
    }

    if (updates.length > 0) {
      // Split batchUpdate into chunks of 1000 to avoid Google Sheets API limit
      const chunkSize = 1000;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: chunk
          }
        });
      }
    }

    return NextResponse.json({ success: true, updatedCount, totalLinesProcessed: sortedLines.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
