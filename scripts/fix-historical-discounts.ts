import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function fix() {
  try {
    console.log("Fetching orders and lines...");
    const orders = await findAllNoCache('Orders');
    const orderLines = await findAllNoCache('Order_Lines');

    const ordersToFix = orders.filter((o: any) => {
      if (o.status !== 'COMPLETED') return false;
      const orderDiscount = Number(o.discount_amount || 0);
      if (orderDiscount <= 0) return false;
      return true;
    });

    console.log(`Found ${ordersToFix.length} orders with discount_amount > 0.`);

    const sheets = getSheetsClient();
    
    // Read raw rows to get row indices
    const resLines = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Order_Lines!A1:Z`,
    });
    const rowsLines = resLines.data.values || [];
    const headersL = rowsLines[0];
    const idIdxL = headersL.indexOf('id');
    const orderIdIdxL = headersL.indexOf('order_id');
    const unitPriceIdxL = headersL.indexOf('unit_price');
    const qtyIdxL = headersL.indexOf('qty');
    const modifiersIdxL = headersL.indexOf('modifiers_json');
    const lineDiscountIdxL = headersL.indexOf('line_discount');

    const resOrders = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Orders!A1:Z`,
    });
    const rowsOrders = resOrders.data.values || [];
    const headersO = rowsOrders[0];
    const idIdxO = headersO.indexOf('id');
    const discountAmountIdxO = headersO.indexOf('discount_amount');

    const lineUpdates: any[] = [];
    const orderUpdates: any[] = [];

    for (const order of ordersToFix) {
      const orderDiscount = Number(order.discount_amount);
      
      // Find lines for this order
      const linesData = [];
      let totalBase = 0;
      
      for (let i = 1; i < rowsLines.length; i++) {
        if (rowsLines[i][orderIdIdxL] === order.id) {
          const qty = Number(rowsLines[i][qtyIdxL] || 1);
          const unitPrice = Number(rowsLines[i][unitPriceIdxL] || 0);
          let modsPrice = 0;
          try {
            const mods = JSON.parse(rowsLines[i][modifiersIdxL] || "[]");
            modsPrice = mods.reduce((sum: number, m: any) => sum + Number(m.price || 0), 0);
          } catch(e) {}
          
          const baseTotal = (unitPrice + modsPrice) * qty;
          totalBase += baseTotal;
          
          linesData.push({
            rowIndex: i,
            baseTotal,
          });
        }
      }

      // Distribute orderDiscount across lines proportionally
      if (linesData.length > 0 && totalBase > 0) {
        let remainingDiscount = orderDiscount;
        for (let j = 0; j < linesData.length; j++) {
          const ld = linesData[j];
          let allocated = 0;
          if (j === linesData.length - 1) {
            allocated = remainingDiscount; // give the rest to the last item to avoid rounding errors
          } else {
            allocated = Math.round((ld.baseTotal / totalBase) * orderDiscount);
            remainingDiscount -= allocated;
          }
          
          lineUpdates.push({
            range: `Order_Lines!${String.fromCharCode(65 + lineDiscountIdxL)}${ld.rowIndex + 1}`,
            values: [[allocated]]
          });
        }
      }

      // Zero out order.discount_amount
      for (let i = 1; i < rowsOrders.length; i++) {
        if (rowsOrders[i][idIdxO] === order.id) {
          orderUpdates.push({
            range: `Orders!${String.fromCharCode(65 + discountAmountIdxO)}${i + 1}`,
            values: [[0]]
          });
          break;
        }
      }
    }

    console.log(`Prepared ${lineUpdates.length} line updates and ${orderUpdates.length} order updates.`);

    if (lineUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID!,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: lineUpdates
        }
      });
      console.log("Line updates successful!");
    }

    if (orderUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID!,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: orderUpdates
        }
      });
      console.log("Order updates successful!");
    }

  } catch (e: any) {
    console.error("Migration error:", e);
  }
}

fix();
