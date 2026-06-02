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

const requiredTabs = [
  { name: 'Semi_Products', headers: ['id', 'name', 'base_unit', 'batch_yield', 'status', 'created_at'] },
  { name: 'Recipes', headers: ['id', 'target_type', 'target_id', 'ingredients_json', 'created_at'] },
];

async function run() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log("Fetching existing spreadsheet metadata...");
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID as string });
  const existingSheets = meta.data.sheets?.map(s => s.properties?.title?.toLowerCase().trim()) || [];
  
  for (const tab of requiredTabs) {
    if (!existingSheets.includes(tab.name.toLowerCase().trim())) {
      console.log(`Creating sheet: ${tab.name}`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID as string,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: tab.name }
              }
            }]
          }
        });
        console.log(`Created: ${tab.name}`);
      } catch (err: any) {
        console.error(`Failed to create ${tab.name}:`, err.message);
      }
    } else {
      console.log(`Sheet already exists: ${tab.name}`);
    }
  }

  console.log("Setting headers...");
  for (const tab of requiredTabs) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID as string,
        range: `${tab.name}!A1:Z1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [tab.headers]
        }
      });
      console.log(`Updated headers for ${tab.name}`);
    } catch (err: any) {
      console.error(`Failed to set headers for ${tab.name}:`, err.message);
    }
  }
  
  console.log("Initialization complete!");
}

run().catch(console.error);
