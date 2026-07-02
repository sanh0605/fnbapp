// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { getSupabaseClient } = await import('../lib/supabase');
  const { readAllFromSheets } = await import('../lib/sheets-source');
  const supabase = getSupabaseClient();

  // Read missing Order_Lines from source.
  const { rows: sourceLines } = await readAllFromSheets('Order_Lines_V2');

  // Read all target Order IDs (paginated).
  const orderIds = new Set<string>();
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('orders_v2')
      .select('id')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) orderIds.add(r.id);
    if (data.length < 1000) break;
    page += 1;
  }
  console.log(`Orders in target: ${orderIds.size}`);

  // Find lines whose order_id not in target.
  const orphanLines = sourceLines.filter((l: any) => l.order_id && !orderIds.has(l.order_id));
  console.log(`Orphan lines (order_id not in target): ${orphanLines.length}`);

  // Sample orphan order_ids.
  const orphanOrderIds = new Set<string>();
  for (const l of orphanLines.slice(0, 100)) orphanOrderIds.add(l.order_id);
  console.log(`Sample orphan order_ids:`);
  for (const id of Array.from(orphanOrderIds).slice(0, 10)) {
    console.log(`  ${id}`);
  }

  // Check if these order_ids are in source Orders_V2.
  const { rows: sourceOrders } = await readAllFromSheets('Orders_V2');
  const sourceOrderIds = new Set(sourceOrders.map((o: any) => o.id));
  console.log(`\nSource Orders_V2 count: ${sourceOrderIds.size}`);
  const inSourceNotTarget = Array.from(orphanOrderIds).filter((id) => sourceOrderIds.has(id));
  console.log(`Orphan order_ids present in source Orders_V2 but not target: ${inSourceNotTarget.length}`);
  for (const id of inSourceNotTarget.slice(0, 5)) console.log(`  ${id}`);
}

main().catch(console.error);
