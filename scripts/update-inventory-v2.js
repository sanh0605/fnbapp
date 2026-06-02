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

async function updateInventoryV2() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  const newTabs = [
    { title: 'Item_Categories', headers: ['id', 'name', 'system_type'] },
    { title: 'Base_Ingredients', headers: ['id', 'name', 'base_unit'] },
    { title: 'Purchased_Items', headers: ['id', 'name', 'item_category_id', 'base_ingredient_id'] },
    { title: 'UOM_Conversions', headers: ['id', 'purchased_item_id', 'purchased_unit', 'base_unit', 'conversion_rate'] }
  ];

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets.map(s => s.properties.title.toLowerCase());

    const requests = [];

    // Delete old tabs if they exist
    const oldTabs = ['inventory_categories'];
    for (const sheet of meta.data.sheets) {
      if (oldTabs.includes(sheet.properties.title.toLowerCase())) {
        requests.push({
          deleteSheet: { sheetId: sheet.properties.sheetId }
        });
      }
    }

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
      console.log('Xóa/Tạo tab thành công.');
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

    console.log('Hoàn thành cập nhật DB V2!');
  } catch (err) {
    console.error('Lỗi:', err);
  }
}

updateInventoryV2();
