/**
 * Google Sheets read-only source adapter.
 *
 * Claude code — Supabase migration Phase C.
 *
 * Used by migration scripts to read source data from Google Sheets while
 * `lib/sheets_db.ts` shim has been swapped to Supabase. This module bypasses
 * the shim with direct `googleapis` calls.
 *
 * Only read operations. No writes — sheets is no longer authoritative.
 */

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 is not set in environment variables');
  }
  const credentialsJson = Buffer.from(
    process.env.GOOGLE_CREDENTIALS_BASE64,
    'base64',
  ).toString('utf-8');
  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function fixDateTime(header: string, val: string): string {
  if (
    (header === 'created_at' || header === 'updated_at' || header === 'event_at' ||
      header === 'completed_at' || header === 'voided_at' || header === 'approved_at' ||
      header === 'transaction_date' || header === 'effective_at') &&
    typeof val === 'string' &&
    val.length > 0
  ) {
    if (!val.endsWith('Z') && !val.includes('+')) {
      return val.replace(' ', 'T') + 'Z';
    }
  }
  return val;
}

/**
 * Read all rows from a sheet as objects keyed by header.
 */
export async function readAllFromSheets(
  sheetName: string,
): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:ZZ`,
  });
  const values = (res.data.values || []) as string[][];
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const raw = row[idx] || '';
      obj[header] = fixDateTime(header, raw);
    });
    return obj;
  });
  return { headers, rows };
}
