import { findAllNoCache, getSheetsClient, getAuth } from '../lib/sheets_db';
import { DBOrder, DBOrderLine, DBPromotion } from '../types/db';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function main() {
  console.log(`Starting migration. DRY_RUN: ${DRY_RUN}`);

  console.log("Fetching data...");
  const [promotions, orders, orderLines] = await Promise.all([
    findAllNoCache("Promotions") as Promise<DBPromotion[]>,
    findAllNoCache("Orders") as Promise<DBOrder[]>,
    findAllNoCache("Order_Lines") as Promise<DBOrderLine[]>
  ]);

  const sheets = getSheetsClient();

  const ordersToUpdate: any[] = [];
  const linesToUpdate: any[] = [];

  // Index rows for batch updates
  const orderSheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Z`,
  });
  const orderRows = orderSheetRes.data.values || [];
  const orderHeaders = orderRows[0];
  const orderIdIdx = orderHeaders.indexOf('id');
  const orderTotalIdx = orderHeaders.indexOf('total_amount');
  const orderDiscountIdx = orderHeaders.indexOf('discount_amount');
  const orderPromoIdIdx = orderHeaders.indexOf('applied_promotion_id');

  const lineSheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:Z`,
  });
  const lineRows = lineSheetRes.data.values || [];
  const lineHeaders = lineRows[0];
  const lineIdIdx = lineHeaders.indexOf('id');
  const lineDiscountIdx = lineHeaders.indexOf('line_discount');

  for (const promo of promotions) {
    if (promo.status !== "ACTIVE") continue;

    const startDate = new Date(promo.start_date);
    const endDate = new Date(promo.end_date);

    console.log(`\nAnalyzing Promotion: ${promo.name} (${promo.id})`);

    const eligibleOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate >= startDate && orderDate <= endDate &&
        (!o.applied_promotion_id || o.applied_promotion_id.trim() === "") &&
        (promo.brand_id === "" || o.brand_id === promo.brand_id) &&
        (o.voided !== "TRUE" && o.voided !== true);
    });

    console.log(`  Found ${eligibleOrders.length} eligible orders.`);

    let applicableItems: Record<string, number> = {};
    try {
      const parsed = JSON.parse(promo.applicable_products_json || "{}");
      if (Array.isArray(parsed)) {
        parsed.forEach(id => { applicableItems[id] = Number(promo.discount_value); });
      } else {
        applicableItems = parsed;
      }
    } catch (e) {
      applicableItems = (promo.applicable_products_json || "").split(",").map(s => s.trim()).filter(Boolean).forEach(id => {
        applicableItems[id] = Number(promo.discount_value);
      }) as any || {};
    }

    for (const order of eligibleOrders) {
      const lines = orderLines.filter(l => l.order_id === order.id);
      let orderExpectedDiscount = 0;
      let orderTargetTotal = 0;
      const currentTotal = Number(order.total_amount || 0);

      const orderLinesToUpdate: { lineId: string, discount: number }[] = [];

      for (const line of lines) {
        const qty = Number(line.qty || 0);
        const originalUnitPrice = Number(line.unit_price || 0);
        
        let modifiersPrice = 0;
        try {
          const modifiers = JSON.parse(line.modifiers_json || "[]");
          if (Array.isArray(modifiers)) {
            modifiersPrice = modifiers.reduce((sum, m) => sum + Number(m.price || 0), 0);
          }
        } catch (e) {}

        const targetId = applicableItems[line.variant_id] !== undefined ? line.variant_id :
          (applicableItems[line.product_id] !== undefined ? line.product_id : null);

        let lineTargetBasePrice = originalUnitPrice;
        let lineDiscountPerUnit = 0;

        if (targetId) {
          const promoValue = Number(applicableItems[targetId]);
          if (promo.discount_type === "PERCENT") {
            lineDiscountPerUnit = originalUnitPrice * (promoValue / 100);
            lineTargetBasePrice = originalUnitPrice - lineDiscountPerUnit;
          } else if (promo.discount_type === "FLAT_PRICE") {
            lineTargetBasePrice = promoValue;
            lineDiscountPerUnit = Math.max(0, originalUnitPrice - promoValue);
          }
        }

        const lineTargetTotal = (lineTargetBasePrice + modifiersPrice) * qty;
        const lineExpectedDiscount = lineDiscountPerUnit * qty;

        orderTargetTotal += lineTargetTotal;
        orderExpectedDiscount += lineExpectedDiscount;

        if (lineExpectedDiscount > 0) {
          orderLinesToUpdate.push({ lineId: line.id, discount: lineExpectedDiscount });
        }
      }

      // Rules implementation
      let finalTotalToSet = currentTotal;
      let finalDiscountToSet = orderExpectedDiscount;

      if (currentTotal === 0) {
        // Rule A: Free Orders
        console.log(`    Order ${order.order_no}: Rule A (Free Order) -> Metadata Only`);
        finalTotalToSet = 0;
        // For free orders, the discount is the whole subtotal usually, 
        // but we'll at least record the promo discount.
        // Actually, if it's 0, maybe we should set discount = subtotal.
        const subtotal = lines.reduce((sum, l) => sum + (Number(l.qty) * (Number(l.unit_price) + (JSON.parse(l.modifiers_json || "[]").reduce((s:any, m:any) => s + Number(m.price || 0), 0)))), 0);
        finalDiscountToSet = subtotal;
      } else if (Math.abs(currentTotal - orderTargetTotal) < 1) {
        // Rule B: Correctly Priced
        console.log(`    Order ${order.order_no}: Rule B (Match) -> Metadata Only`);
        finalTotalToSet = currentTotal;
      } else {
        // Rule C: Mismatch
        console.log(`    Order ${order.order_no}: Rule C (Mismatch) -> Adjusting Total: ${currentTotal} -> ${orderTargetTotal}`);
        finalTotalToSet = orderTargetTotal;
      }

      // Prepare updates
      const orderRowIdx = orderRows.findIndex(r => r[orderIdIdx] === order.id);
      if (orderRowIdx !== -1) {
        ordersToUpdate.push({
          row: orderRowIdx + 1,
          total: finalTotalToSet,
          discount: finalDiscountToSet,
          promoId: promo.id
        });

        for (const lineUpdate of orderLinesToUpdate) {
          const lineRowIdx = lineRows.findIndex(r => r[lineIdIdx] === lineUpdate.lineId);
          if (lineRowIdx !== -1) {
            linesToUpdate.push({
              row: lineRowIdx + 1,
              discount: lineUpdate.discount
            });
          }
        }
      }
    }
  }

  console.log(`\nFound ${ordersToUpdate.length} orders and ${linesToUpdate.length} lines to update.`);

  if (DRY_RUN) {
    console.log("DRY_RUN is true. No changes applied.");
    return;
  }

  if (ordersToUpdate.length > 0) {
    const batchRequests: any[] = [];

    ordersToUpdate.forEach(u => {
      const colLetterTotal = String.fromCharCode(65 + orderTotalIdx);
      const colLetterDiscount = String.fromCharCode(65 + orderDiscountIdx);
      const colLetterPromo = String.fromCharCode(65 + orderPromoIdIdx);

      batchRequests.push({
        range: `Orders!${colLetterTotal}${u.row}`,
        values: [[u.total]]
      });
      batchRequests.push({
        range: `Orders!${colLetterDiscount}${u.row}`,
        values: [[u.discount]]
      });
      batchRequests.push({
        range: `Orders!${colLetterPromo}${u.row}`,
        values: [[u.promoId]]
      });
    });

    linesToUpdate.forEach(u => {
      const colLetterDiscount = String.fromCharCode(65 + lineDiscountIdx);
      batchRequests.push({
        range: `Order_Lines!${colLetterDiscount}${u.row}`,
        values: [[u.discount]]
      });
    });

    console.log(`Applying ${batchRequests.length} cell updates in batches...`);
    
    const CHUNK_SIZE = 50;
    for (let i = 0; i < batchRequests.length; i += CHUNK_SIZE) {
      const chunk = batchRequests.slice(i, i + CHUNK_SIZE);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: chunk
        }
      });
      console.log(`  Updated ${i + chunk.length}/${batchRequests.length}`);
      await new Promise(r => setTimeout(r, 500));
    }
    console.log("Migration complete!");
  }
}

main().catch(console.error);
