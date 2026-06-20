import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function migrate() {
  try {
    console.log("Fetching orders and lines...");
    const orders = await findAllNoCache('Orders');
    const orderLines = await findAllNoCache('Order_Lines');

    const proratedOrders = new Set(orders.filter((o: any) => {
      if (o.status !== 'COMPLETED') return false;
      const orderDiscount = Number(o.discount_amount || 0);
      if (orderDiscount <= 0) return false;

      const lines = orderLines.filter((l: any) => l.order_id === o.id);
      const totalLineDiscount = lines.reduce((sum: number, l: any) => sum + Number(l.line_discount || 0), 0);
      
      return Math.abs(totalLineDiscount - orderDiscount) < 2;
    }).map((o: any) => o.id));

    console.log(`Found ${proratedOrders.size} prorated orders.`);

    const sheets = getSheetsClient();
    
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Order_Lines!A1:Z`,
    });
    
    const rows = res.data.values || [];
    if (rows.length < 2) {
      console.log("No order lines found.");
      return;
    }
    
    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    const orderIdIndex = headers.indexOf('order_id');
    const lineDiscountIndex = headers.indexOf('line_discount');
    
    if (idIndex === -1 || orderIdIndex === -1 || lineDiscountIndex === -1) {
      throw new Error("Missing necessary columns in Order_Lines");
    }

    const updates = [];
    let updatedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const orderId = rows[i][orderIdIndex];
      const currentLineDiscount = Number(rows[i][lineDiscountIndex] || 0);
      
      if (proratedOrders.has(orderId) && currentLineDiscount > 0) {
        const rowNumber = i + 1;
        updates.push({
          range: `Order_Lines!${String.fromCharCode(65 + lineDiscountIndex)}${rowNumber}`,
          values: [[0]]
        });
        updatedCount++;
      }
    }

    console.log(`Prepared ${updatedCount} lines to update.`);

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID!,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates
        }
      });
      console.log("Batch update successful!");
    } else {
      console.log("Nothing to update.");
    }
  } catch (e: any) {
    console.error("Migration error:", e);
  }
}

migrate();
