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

async function createUnitsTable() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Units',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10,
                },
              },
            },
          }
        ],
      },
    });
    console.log('Đã tạo tab Units');

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Units!A1:D1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id', 'name', 'description', 'created_at']],
      },
    });
    console.log('Đã thêm headers cho Units');
    
    // Add some default units
    await sheets.spreadsheets.values.append({
       spreadsheetId,
       range: 'Units!A2:D2',
       valueInputOption: 'RAW',
       requestBody: {
         values: [
            ['U-001', 'gram', 'Gram', new Date().toISOString()],
            ['U-002', 'kg', 'Kilogram', new Date().toISOString()],
            ['U-003', 'ml', 'Milliliters', new Date().toISOString()],
            ['U-004', 'lít', 'Lít', new Date().toISOString()],
            ['U-005', 'Hộp', 'Hộp', new Date().toISOString()],
            ['U-006', 'Thùng', 'Thùng', new Date().toISOString()],
            ['U-007', 'Bao', 'Bao', new Date().toISOString()]
         ]
       }
    })

  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Tab Units đã tồn tại');
    } else {
      console.error('Lỗi:', err.message);
    }
  }
}

createUnitsTable();
