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

  console.log("Setting new headers for Base_Ingredients...");
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID as string,
      range: `Base_Ingredients!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['id', 'name', 'base_unit', 'is_non_inventory']]
      }
    });
    console.log("Updated headers for Base_Ingredients");
  } catch (err: any) {
    console.error("Failed to update headers:", err.message);
  }
}

run().catch(console.error);
