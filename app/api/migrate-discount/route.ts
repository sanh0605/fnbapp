import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

export async function GET() {
  try {
    const sheets = getSheetsClient();
    
    // Process Orders table
    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A1:Z1',
    });
    let ordersHeaders = ordersRes.data.values?.[0] || [];
    let updatedOrders = false;
    
    if (!ordersHeaders.includes('discount_amount')) {
      ordersHeaders.push('discount_amount');
      updatedOrders = true;
    }
    if (!ordersHeaders.includes('discount_type')) {
      ordersHeaders.push('discount_type');
      updatedOrders = true;
    }

    if (updatedOrders) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Orders!A1:Z1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [ordersHeaders],
        },
      });
    }

    // Process Order_Lines table
    const linesRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Order_Lines!A1:Z1',
    });
    let linesHeaders = linesRes.data.values?.[0] || [];
    let updatedLines = false;
    
    if (!linesHeaders.includes('line_discount')) {
      linesHeaders.push('line_discount');
      updatedLines = true;
    }
    if (!linesHeaders.includes('discount_type')) {
      linesHeaders.push('discount_type');
      updatedLines = true;
    }

    if (updatedLines) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Order_Lines!A1:Z1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [linesHeaders],
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Successfully added discount columns to Orders and Order_Lines sheets",
      ordersHeaders,
      linesHeaders
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
