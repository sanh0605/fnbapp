import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function getAuth() {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64 || '', 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function run() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID as string,
      range: 'Purchase_Orders!A1:Z1',
    });
    const headers = res.data.values?.[0] || [];
    if (!headers.includes('transaction_date')) {
      headers.push('transaction_date');
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID as string,
        range: 'Purchase_Orders!A1:Z1',
        valueInputOption: 'RAW',
        requestBody: { values: [headers] }
      });
      console.log('Added transaction_date to Purchase_Orders');
    } else {
      console.log('transaction_date already exists');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
run().catch(console.error);
