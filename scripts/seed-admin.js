const path = require('path');
const { google } = require('googleapis');
const SPREADSHEET_ID = '1RF-B2DLjLxuJ9VWtqJhiQLb5qlcUFVoehl7RxOP6xNc';
const KEY_FILE_PATH = path.join(__dirname, '..', 'beverages-496303-1b8b558284f8.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function seedAdmin() {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `Users!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['USR-001', 'admin', '123456', 'ADMIN', new Date().toISOString()]],
    },
  });
  console.log("Admin seeded to Google Sheets");
}

seedAdmin().catch(console.error);
