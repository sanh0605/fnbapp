/**
 * Verify parity between Google Sheets and Supabase for one or all sheets.
 *
 * Claude code — Supabase migration Phase C.
 *
 * Usage:
 *   vite-node scripts/verify-sheet-supabase-parity.ts <SheetName>
 *   vite-node scripts/verify-sheet-supabase-parity.ts --all
 *
 * Compares row counts + IDs. Reports:
 *   - Sheets with parity (counts match)
 *   - Sheets missing in Supabase (need migration)
 *   - Sheets with extra rows in Supabase (drift)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.CLI_MODE = 'true';

const SHEETS_TO_VERIFY = [
  // Reference
  'Brands', 'Product_Categories', 'Item_Categories', 'Units',
  'Suppliers', 'Purchase_Sources', 'Users',
  // Catalog
  'Products', 'Product_Variants', 'Modifiers', 'Recipes', 'Promotions',
  'Base_Ingredients', 'Semi_Products', 'Purchased_Items', 'UOM_Conversions',
  'Product_Price_History',
  // Transactions
  'Orders_V2', 'Order_Lines_V2', 'Order_Events', 'Stock_Ledger',
  'Purchase_Orders', 'Purchase_Order_Lines', 'Stock_Adjustments',
  'Production_Orders', 'Production_Items', 'POS_Drafts',
];

function normalizeTableName(sheetName: string): string {
  return sheetName.toLowerCase();
}

async function verifySheet(
  sheetName: string,
  readAllFromSheets: (s: string) => Promise<{ rows: any[] }>,
  supabase: any,
): Promise<{ sheet: string; sourceCount: number; targetCount: number; onlyInSource: number; onlyInTarget: number; status: string }> {
  const tableName = normalizeTableName(sheetName);
  const { rows: sourceRows } = await readAllFromSheets(sheetName);
  const sourceIds = new Set(sourceRows.map((r: any) => r.id).filter(Boolean));

  // Paginate target reads (default PostgREST limit is 1000).
  const targetIds = new Set<string>();
  let page = 0;
  const PAGE_SIZE = 1000;
  let targetError: string | null = null;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      targetError = error.message;
      break;
    }
    if (!data || data.length === 0) break;
    for (const r of data) targetIds.add(r.id);
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  if (targetError) {
    return {
      sheet: sheetName,
      sourceCount: sourceRows.length,
      targetCount: -1,
      onlyInSource: -1,
      onlyInTarget: -1,
      status: `ERROR: ${targetError}`,
    };
  }

  let onlyInSource = 0;
  let onlyInTarget = 0;
  for (const id of sourceIds) if (!targetIds.has(id)) onlyInSource++;
  for (const id of targetIds) if (!sourceIds.has(id)) onlyInTarget++;

  let status: string;
  if (onlyInSource === 0 && onlyInTarget === 0) {
    status = 'PARITY';
  } else if (targetIds.size === 0) {
    status = 'EMPTY_TARGET';
  } else if (onlyInSource > 0) {
    status = `MISSING_IN_TARGET(${onlyInSource})`;
  } else {
    status = `DRIFT_EXTRA_IN_TARGET(${onlyInTarget})`;
  }

  return {
    sheet: sheetName,
    sourceCount: sourceRows.length,
    targetCount: targetIds.size,
    onlyInSource,
    onlyInTarget,
    status,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const singleSheet = args.find((a) => !a.startsWith('--'));

  const { readAllFromSheets } = await import('../lib/sheets-source');
  const { getSupabaseClient } = await import('../lib/supabase');
  const supabase = getSupabaseClient();

  const sheets = all ? SHEETS_TO_VERIFY : singleSheet ? [singleSheet] : null;
  if (!sheets) {
    console.error('Usage: vite-node scripts/verify-sheet-supabase-parity.ts <SheetName|--all>');
    process.exit(1);
  }

  console.log('=== SHEETS vs SUPABASE PARITY ===\n');
  console.log(
    'Sheet | Source | Target | Missing | Extra | Status'.padEnd(70),
  );
  console.log('-'.repeat(70));

  const results = [];
  for (const sheet of sheets) {
    try {
      const r = await verifySheet(sheet, readAllFromSheets as any, supabase);
      results.push(r);
      console.log(
        `${r.sheet} | ${r.sourceCount} | ${r.targetCount} | ${r.onlyInSource} | ${r.onlyInTarget} | ${r.status}`,
      );
    } catch (err: any) {
      console.log(`${sheet} | ERROR: ${err.message}`);
    }
  }

  // Summary.
  const parity = results.filter((r) => r.status === 'PARITY').length;
  const emptyTarget = results.filter((r) => r.status === 'EMPTY_TARGET').length;
  const missing = results.filter((r) => r.status.startsWith('MISSING')).length;
  const drift = results.filter((r) => r.status.startsWith('DRIFT')).length;
  console.log('\n=== SUMMARY ===');
  console.log(`Total sheets: ${results.length}`);
  console.log(`PARITY: ${parity}`);
  console.log(`EMPTY_TARGET: ${emptyTarget}`);
  console.log(`MISSING_IN_TARGET: ${missing}`);
  console.log(`DRIFT_EXTRA: ${drift}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
