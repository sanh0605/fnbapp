const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function getSheetsClient() {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

async function initPOTables() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  const newTabs = [
    { title: 'Purchase_Orders', headers: ['id', 'supplier_id', 'status', 'total_amount', 'notes', 'created_by', 'created_at'] },
    { title: 'Purchase_Order_Lines', headers: ['id', 'po_id', 'purchased_item_id', 'unit', 'quantity', 'unit_price', 'subtotal'] },
    { title: 'Stock_Ledger', headers: ['id', 'transaction_type', 'reference_id', 'item_reference', 'quantity_change', 'unit_cost', 'created_at'] }
  ];

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets.map(s => s.properties.title.toLowerCase());

    const requests = [];

    // Add new tabs
    for (const tab of newTabs) {
      if (!existingSheets.includes(tab.title.toLowerCase())) {
        requests.push({
          addSheet: {
            properties: { title: tab.title }
          }
        });
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
      console.log('Tạo tab thành công.');
    } else {
      console.log('Các tab đã tồn tại.');
    }

    // Write headers
    for (const tab of newTabs) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab.title}!A1:Z1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [tab.headers]
        }
      });
      console.log(`Đã cập nhật headers cho ${tab.title}`);
    }

    console.log('Hoàn thành cập nhật DB cho Purchase Orders!');
  } catch (err) {
    console.error('Lỗi:', err);
  }
}

initPOTables();
