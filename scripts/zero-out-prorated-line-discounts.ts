import { findAllNoCache, update, getSheetsClient } from '../lib/sheets_db';

async function migrate() {
  try {
    console.log('Starting migration: zeroing out prorated line discounts...');
    
    const orders = await findAllNoCache('Orders');
    const orderLines = await findAllNoCache('Order_Lines');

    const proratedOrders = orders.filter((o: any) => {
      if (o.status !== 'COMPLETED') return false;
      const orderDiscount = Number(o.discount_amount || 0);
      if (orderDiscount <= 0) return false;

      const lines = orderLines.filter((l: any) => l.order_id === o.id);
      const totalLineDiscount = lines.reduce((sum: number, l: any) => sum + Number(l.line_discount || 0), 0);
      
      // If sum of line discounts matches order discount, it was prorated
      return Math.abs(totalLineDiscount - orderDiscount) < 2;
    });

    console.log(`Found ${proratedOrders.length} orders with prorated discounts.`);

    for (const order of proratedOrders) {
      const lines = orderLines.filter((l: any) => l.order_id === order.id);
      console.log(`Processing Order ${order.id}...`);
      
      for (const line of lines) {
        if (Number(line.line_discount || 0) > 0) {
          await update('Order_Lines', line.id, { line_discount: 0 });
          console.log(`  Updated Line ${line.id}: line_discount set to 0`);
        }
      }
    }

    console.log('Migration completed successfully.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
