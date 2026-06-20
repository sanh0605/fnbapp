import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function recover() {
  try {
    console.log("Fetching orders and lines...");
    const orders = await findAllNoCache('Orders');
    
    // Find orders that were mistakenly migrated as ORDER_DISCOUNT but were actually PRODUCT_DISCOUNT
    const productDiscountOrders = orders.filter((o: any) => {
      if (Number(o.discount_amount || 0) <= 0) return false;
      if (!o.applied_promotion_snapshot_json) return false;
      
      try {
        const promo = JSON.parse(o.applied_promotion_snapshot_json);
        return promo.type === "PRODUCT_DISCOUNT";
      } catch(e) {
        return false;
      }
    });

    console.log(`Found ${productDiscountOrders.length} PRODUCT_DISCOUNT orders that need recovery.`);
    
    if (productDiscountOrders.length === 0) return;

    const sheets = getSheetsClient();
    
    const resLines = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Order_Lines!A1:Z`,
    });
    
    const rowsLines = resLines.data.values || [];
    const headersLines = rowsLines[0];
    const idIndexL = headersLines.indexOf('id');
    const orderIdIndexL = headersLines.indexOf('order_id');
    const variantIdIndexL = headersLines.indexOf('variant_id');
    const unitPriceIndexL = headersLines.indexOf('unit_price');
    const qtyIndexL = headersLines.indexOf('qty');
    const lineDiscountIndexL = headersLines.indexOf('line_discount');
    
    const updates = [];
    
    for (const order of productDiscountOrders) {
      const promo = JSON.parse(order.applied_promotion_snapshot_json);
      let applicableVariantsList: string[] = [];
      let applicableVariantsMap: Record<string, number> = {};
      let isMap = false;
      
      try {
        if (promo.applicable_products_json) {
          const parsed = JSON.parse(promo.applicable_products_json);
          if (Array.isArray(parsed)) {
            applicableVariantsList = parsed;
          } else if (parsed && typeof parsed === "object") {
            applicableVariantsMap = parsed;
            applicableVariantsList = Object.keys(parsed);
            isMap = true;
          }
        }
      } catch(e) {}

      for (let i = 1; i < rowsLines.length; i++) {
        if (rowsLines[i][orderIdIndexL] === order.id) {
          const variantId = rowsLines[i][variantIdIndexL];
          if (applicableVariantsList.includes(variantId)) {
             const qty = Number(rowsLines[i][qtyIndexL]);
             const unitPrice = Number(rowsLines[i][unitPriceIndexL]);
             
             const val = isMap ? Number(applicableVariantsMap[variantId]) : Number(promo.discount_value);
             
             let lineDiscount = 0;
             if (promo.discount_type === "PERCENT") {
               lineDiscount = (unitPrice * qty) * (val / 100);
             } else if (promo.discount_type === "FLAT_PRICE") {
               lineDiscount = Math.max(0, unitPrice - val) * qty;
             } else {
               lineDiscount = val * qty;
             }
             
             updates.push({
                range: `Order_Lines!${String.fromCharCode(65 + lineDiscountIndexL)}${i + 1}`,
                values: [[lineDiscount]]
             });
          }
        }
      }
    }

    console.log(`Prepared ${updates.length} lines to restore.`);

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID!,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates
        }
      });
      console.log("Lines restored.");
      
      // Now we also need to zero out order.discount_amount for these orders
      const resOrders = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Orders!A1:Z`,
      });
      const rowsOrders = resOrders.data.values || [];
      const headersOrders = rowsOrders[0];
      const idIndexO = headersOrders.indexOf('id');
      const discountAmountIndexO = headersOrders.indexOf('discount_amount');
      
      const orderUpdates = [];
      for (let i = 1; i < rowsOrders.length; i++) {
        if (productDiscountOrders.find((o: any) => o.id === rowsOrders[i][idIndexO])) {
          orderUpdates.push({
            range: `Orders!${String.fromCharCode(65 + discountAmountIndexO)}${i + 1}`,
            values: [[0]]
          });
        }
      }
      
      if (orderUpdates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID!,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: orderUpdates
          }
        });
        console.log("Orders discount_amount zeroed out.");
      }
    }
  } catch (e: any) {
    console.error("Migration error:", e);
  }
}

recover();
