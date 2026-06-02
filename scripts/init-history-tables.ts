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

  console.log("Adding end_date to Recipes...");
  try {
    // Current headers: id, target_type, target_id, ingredients_json, created_at
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID as string,
      range: `Recipes!A1:F1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['id', 'target_type', 'target_id', 'ingredients_json', 'created_at', 'end_date']]
      }
    });
    console.log("Updated headers for Recipes");
  } catch (err: any) {
    console.error("Failed to update Recipes headers:", err.message);
  }

  console.log("Creating Product_Price_History...");
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID as string });
    const existingSheets = meta.data.sheets?.map(s => s.properties?.title?.toLowerCase()) || [];

    if (!existingSheets.includes("product_price_history")) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID as string,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: "Product_Price_History" } }
          }]
        }
      });
      console.log("Created Product_Price_History tab");
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID as string,
        range: `Product_Price_History!A1:E1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'variant_id', 'price', 'created_at', 'end_date']]
        }
      });
      console.log("Updated headers for Product_Price_History");
    } else {
      console.log("Product_Price_History already exists");
    }
  } catch (err: any) {
    console.error("Failed to create Price History:", err.message);
  }
}

run().catch(console.error);
