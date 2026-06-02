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

async function updatePOHeaders() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  const newHeaders = ['id', 'supplier_id', 'status', 'total_amount', 'subtotal_amount', 'shipping_fee', 'tax_amount', 'voucher_amount', 'discount_amount', 'notes', 'created_by', 'created_at'];

  try {
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Purchase_Orders!A1:Z1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [newHeaders]
      }
    });
    console.log(`Đã cập nhật headers cho Purchase_Orders với Landed Cost`);
  } catch (err) {
    console.error('Lỗi:', err);
  }
}

updatePOHeaders();
