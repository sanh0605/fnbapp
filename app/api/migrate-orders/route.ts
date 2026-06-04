import { NextResponse } from "next/server";
import { findAllNoCache, getSheetsClient, getHeaders } from "@/lib/sheets_db";
import { revalidateTag } from "next/cache";

export async function GET() {
  try {
    const orders = await findAllNoCache("Orders");
    const brands = await findAllNoCache("Brands");
    
    if (orders.length === 0) {
      return NextResponse.json({ success: true, message: "No orders to migrate" });
    }

    const fallbackBrand = brands[0] || { code: "ORD", id: "" };

    // Sort chronologically to determine correct sequence numbers
    const sortedOrders = [...orders].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    
    const newNumbers: Record<string, string> = {}; 
    const brandCounts: Record<string, number> = {};
    
    for (const order of sortedOrders) {
      const brandId = order.brand_id || fallbackBrand.id;
      const brandCode = brands.find((b:any) => b.id === brandId)?.code || fallbackBrand.code;
      
      if (!brandCounts[brandId]) brandCounts[brandId] = 0;
      brandCounts[brandId]++;
      
      newNumbers[order.id] = `${brandCode}${brandCounts[brandId].toString().padStart(6, '0')}`;
    }
    
    const headers = await getHeaders("Orders");
    const dataValues = orders.map(obj => {
      obj.order_no = newNumbers[obj.id] || obj.order_no;
      return headers.map(h => obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : '');
    });
    
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `Orders!A2:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: dataValues,
      },
    });

    revalidateTag('sheets');

    return NextResponse.json({ success: true, migratedCount: dataValues.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
