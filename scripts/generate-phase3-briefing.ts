import * as fs from 'fs';
import * as path from 'path';
import { findAllNoCache, getSheetsClient } from '../lib/sheets_db';

async function main() {
  const data = JSON.parse(fs.readFileSync('scripts/output/classification.json', 'utf8'));
  const orders = await findAllNoCache('Orders');
  const promos = await findAllNoCache('Promotions');
  const products = await findAllNoCache('Products');
  const variants = await findAllNoCache('Product_Variants');

  const sheets = getSheetsClient();
  const resOrdersHeader = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: 'Orders!1:1'
  });
  const headers = resOrdersHeader.data.values?.[0] || [];
  const requiredColumns = [
    'id', 'order_no', 'total_amount', 'status', 'created_at',
    'subtotal', 'subtotal_amount', 'discount_amount', 'actual_received',
    'method', 'items', 'staff_name', 'outlet_id', 'brand_id',
    'voided', 'discount_type', 'applied_promotion_id',
    'applied_promotion_snapshot_json', 'discount_reason'
  ];
  const missingColumns = requiredColumns.filter(c => !headers.includes(c));

  let earliest = '2099', latest = '1970';
  data.orders.forEach((o: any) => {
    if (o.createdAt < earliest) earliest = o.createdAt;
    if (o.createdAt > latest) latest = o.createdAt;
  });

  let md = '# Phase 3 Briefing — Promo Classification Results\n\n';
  md += '## Summary\n';
  md += `- Total COMPLETED orders processed: ${data.totalOrdersProcessed}\n`;
  md += `- Date range processed: ${earliest} → ${latest}\n`;
  md += `- Generated at: ${data.generatedAt}\n\n`;

  md += '## Tier counts (table)\n| Tier | Count | Action implication |\n|---|---|---|\n';
  const cMap: any = { CONFIRMED: 0, INFERRED_HIGH: 0, INFERRED_MEDIUM: 0, INFERRED_LOW: 0, AMBIGUOUS: 0, NO_PROMO: 0 };
  data.orders.forEach((o: any) => cMap[o.tier]++);
  
  md += `| CONFIRMED | ${cMap.CONFIRMED} | line_discount already correct — no fix needed |\n`;
  md += `| INFERRED_HIGH | ${cMap.INFERRED_HIGH} | line_discount correct, applied_promotion_id missing — backfill candidate |\n`;
  md += `| INFERRED_MEDIUM | ${cMap.INFERRED_MEDIUM} | n/a |\n`;
  md += `| INFERRED_LOW | ${cMap.INFERRED_LOW} | n/a — backfill in 6b6c038 already recovered these |\n`;
  md += `| AMBIGUOUS | ${cMap.AMBIGUOUS} | needs manual review |\n`;
  md += `| NO_PROMO | ${cMap.NO_PROMO} | no PRODUCT_DISCOUNT applicable |\n\n`;

  md += '## Section 1: 12 INFERRED_HIGH orders (backfill candidates)\n\n';
  md += '| order_no | created_at | matchedPromoId | matchedPromoName | order.discount_amount | applicable_variants_in_cart |\n';
  md += '|---|---|---|---|---|---|\n';
  
  const infHigh = data.orders.filter((o: any) => o.tier === 'INFERRED_HIGH');
  infHigh.forEach((o: any) => {
    const oDb = orders.find((x: any) => x.id === o.orderId);
    const appVars = o.lines.filter((l: any) => l.isApplicable).map((l: any) => l.variantId).join(', ');
    md += `| ${o.orderNo} | ${o.createdAt} | ${o.matchedPromoId} | ${o.matchedPromoName} | ${oDb?.discount_amount || 0} | ${appVars} |\n`;
  });

  md += '\nTwo sample orders:\n\n';
  infHigh.slice(0, 2).forEach((o: any) => {
    md += `**${o.orderNo}** (${o.createdAt})\n`;
    o.lines.forEach((l: any) => {
      const vName = variants.find((v: any) => v.id === l.variantId)?.size_name || l.variantId;
      const product = products.find((p: any) => p.id === variants.find((v: any) => v.id === l.variantId)?.product_id);
      const pName = product ? product.name : '';
      md += `- ${pName} (${vName}): qty ${l.qty}, unit_price ${l.unitPrice}, line_discount ${l.lineDiscount} (Applicable: ${l.isApplicable})\n`;
    });
    md += '\nApplicable lines expected vs actual:\n';
    o.evidence.applicableLinesSummary.forEach((m: any) => {
      md += `- ${m.variantId}: expected ${m.expected}, actual ${m.actual}, diff ${m.diff}\n`;
    });
    md += '\n';
  });
  
  md += 'Question for User: should we backfill applied_promotion_id on these 12 orders?\n';
  md += '(Risk: very low — line_discount already proves the promo applied.)\n\n';

  md += '## Section 2: 5 ghost-promo orders (PRM-003 set, no applicable variant)\n\n';
  const ghostIds = ['PHD000351', 'PHD000352', 'PHD000353', 'PHD000354', 'PHD000355'];
  const ghosts = orders.filter((o: any) => ghostIds.includes(o.order_no));
  
  ghosts.forEach((o: any) => {
    md += `### ${o.order_no}\n`;
    md += `- created_at: ${o.created_at}, staff: ${o.staff_name}\n`;
    md += `- order.discount_amount: ${o.discount_amount || 0}, subtotal: ${o.subtotal || o.subtotal_amount || 0}, total: ${o.total_amount}\n`;
    const lines = data.orders.find((x: any) => x.orderId === o.id)?.lines || [];
    lines.forEach((l: any) => {
      const vName = variants.find((v: any) => v.id === l.variantId)?.size_name || l.variantId;
      const product = products.find((p: any) => p.id === variants.find((v: any) => v.id === l.variantId)?.product_id);
      const pName = product ? product.name : '';
      md += `- Line: ${pName} (${vName}), qty ${l.qty}, unit_price ${l.unitPrice}, line_discount ${l.lineDiscount}\n`;
    });
    md += '\n';
  });

  const prm3 = promos.find((p: any) => p.id === 'PRM-003');
  md += `PRM-003 applicable_products_json current state:\n\`\`\`json\n${prm3?.applicable_products_json}\n\`\`\`\n\n`;
  md += 'Interpretation: These orders have PRM-003 set in `applied_promotion_id`, but none of their cart items are in the current applicable_products_json. Since we do not have historical promo state, it is possible the variants were removed from the promo after the sale, or the cashier scanned the code out of habit even though the cart did not qualify.\n\n';
  md += 'Question for User: clear applied_promotion_id on these 5 orders, leave as-is, or deeper investigation?\n\n';

  md += '## Section 3: 1 AMBIGUOUS order\n\n';
  const amb = data.orders.find((o: any) => o.tier === 'AMBIGUOUS');
  if (amb) {
    const oDb = orders.find((x: any) => x.id === amb.orderId);
    md += `- order_no: ${amb.orderNo}\n`;
    md += `- created_at: ${amb.createdAt}\n`;
    md += `- applied_promotion_id: ${oDb?.applied_promotion_id || 'none'}\n`;
    md += `- order.discount_amount: ${oDb?.discount_amount || 0}\n`;
    md += `- Lines:\n`;
    amb.lines.forEach((l: any) => md += `  - ${l.variantId}: qty ${l.qty}, unit_price ${l.unitPrice}, line_discount ${l.lineDiscount}\n`);
    md += `- candidatePromoIds: ${amb.evidence.candidatePromoIds.join(', ')}\n`;
    md += `- Why ambiguous: ${amb.evidence.rule}\n\n`;
  }
  md += 'Question for User: manual classification or skip?\n\n';

  md += '## Section 4: Schema repair status\n\n';
  md += 'Missing columns from DBOrder interface:\n';
  missingColumns.forEach(c => md += `- ${c}${c === 'applied_promotion_snapshot_json' ? ' (CRITICAL)' : ''}\n`);
  md += '\nQuestion for User: run schema repair script (Phase 5) to add missing columns?\n\n';

  md += '## Section 5: Cross-check on CONFIRMED orders\n\n';
  const confOrders = data.orders.filter((o: any) => o.tier === 'CONFIRMED');
  let confWithDisc = 0;
  const confSamples: string[] = [];
  confOrders.forEach((c: any) => {
    const oDb = orders.find((x: any) => x.id === c.orderId);
    if (Number(oDb?.discount_amount || 0) > 0) {
      confWithDisc++;
      if (confSamples.length < 3) confSamples.push(c.orderNo);
    }
  });

  md += `Among 283 CONFIRMED orders, orders with order.discount_amount > 0: ${confWithDisc}\n`;
  if (confWithDisc > 0) {
    md += `Samples: ${confSamples.join(', ')}\n\n`;
    md += "Question for User: if any CONFIRMED orders have discount_amount > 0 AND non-applicable lines with line_discount > 0, the original fix script's redistribution logic is still relevant. Should we run it gated to CONFIRMED orders only?\n";
  } else {
    md += 'Since this is 0, the UCK000094-style combo (PRODUCT_DISCOUNT + manual order discount) does not exist in the confirmed pool. No redistribution fix is needed.\n';
  }

  fs.writeFileSync('scripts/output/phase3-briefing.md', md);
  console.log(md);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});