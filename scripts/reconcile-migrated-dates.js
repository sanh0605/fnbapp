const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = 'sb_publishable_rhbewMyE6ws9G3_DSmEbfg_w0omMwFI';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function getSheetsClient() {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function main() {
  console.log("Connecting to Supabase and Google Sheets...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sheets = await getSheetsClient();

  // 1. Fetch all orders from Google Sheets to identify which ones need fixing
  console.log("Fetching orders from Google Sheets...");
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Orders!A1:Z',
  });
  const rows = sheetRes.data.values || [];
  if (rows.length === 0) {
    console.log("No orders found in Google Sheets.");
    return;
  }

  const headers = rows[0];
  const idIdx = headers.indexOf('id');
  const createdAtIdx = headers.indexOf('created_at');

  if (idIdx === -1 || createdAtIdx === -1) {
    console.error("Required columns 'id' or 'created_at' not found in Orders sheet.");
    return;
  }

  // Filter for UUID-style IDs (likely migrated from Supabase)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const migratedOrders = [];
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][idIdx];
    if (uuidRegex.test(id)) {
      migratedOrders.push({ id, rowIndex: i + 1, currentCreatedAt: rows[i][createdAtIdx] });
    }
  }

  console.log(`Found ${migratedOrders.length} potentially migrated orders (UUID-style IDs).`);

  // 2. Fetch all orders from Supabase
  console.log("Fetching orders from Supabase...");
  const { data: supabaseOrders, error } = await supabase
    .from('orders')
    .select('id, created_at');

  if (error) {
    console.error("Error fetching from Supabase:", error);
    return;
  }

  const supabaseMap = new Map(supabaseOrders.map(o => [o.id, o.created_at]));

  // 3. Compare and prepare updates
  const updates = [];
  for (const order of migratedOrders) {
    const correctDate = supabaseMap.get(order.id);
    if (correctDate && correctDate !== order.currentCreatedAt) {
      updates.push({
        range: `Orders!${String.fromCharCode(65 + createdAtIdx)}${order.rowIndex}`,
        values: [[correctDate]]
      });
    }
  }

  console.log(`Identified ${updates.length} orders with date mismatches.`);

  if (updates.length === 0) {
    console.log("All dates are already correct.");
    return;
  }

  // 4. Apply updates in batches
  console.log(`Applying updates in batches...`);
  const CHUNK_SIZE = 50;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: chunk
      }
    });
    console.log(`  Updated ${Math.min(i + CHUNK_SIZE, updates.length)}/${updates.length}`);
  }

  console.log("Reconciliation complete!");
}

main().catch(console.error);
