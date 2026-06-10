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

async function run() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  try {
    console.log("Checking sheets...");
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets.map(s => s.properties.title.toLowerCase());

    // 1. Create Promotions sheet if it does not exist
    if (!existingSheets.includes('promotions')) {
      console.log("Creating 'Promotions' sheet...");
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: 'Promotions' }
            }
          }]
        }
      });
      console.log("'Promotions' sheet created.");
    } else {
      console.log("'Promotions' sheet already exists.");
    }

    // 2. Set headers for Promotions sheet
    const promoHeaders = [
      'id', 'name', 'code', 'brand_id', 'type', 'discount_type', 
      'discount_value', 'min_order_value', 'start_date', 'end_date', 
      'applicable_products_json', 'status', 'created_at'
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Promotions!A1:M1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [promoHeaders]
      }
    });
    console.log("Headers set for 'Promotions' sheet.");

    // 3. Append applied_promotion_id to Orders sheet if missing
    console.log("Checking 'Orders' sheet headers...");
    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A1:Z1',
    });
    const orderHeaders = ordersRes.data.values ? ordersRes.data.values[0] : [];
    
    if (!orderHeaders.includes('applied_promotion_id')) {
      console.log("Adding 'applied_promotion_id' to 'Orders' headers...");
      orderHeaders.push('applied_promotion_id');
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!A1:${String.fromCharCode(65 + orderHeaders.length - 1)}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [orderHeaders]
        }
      });
      console.log("'Orders' headers updated.");
    } else {
      console.log("'applied_promotion_id' is already in 'Orders' headers.");
    }

    console.log("Database schema initialized successfully!");
  } catch (error) {
    console.error("Initialization error:", error);
  }
}
run();
