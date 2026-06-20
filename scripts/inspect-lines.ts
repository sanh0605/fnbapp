import { findAllNoCache } from "../lib/sheets_db";

async function inspectLines() {
    const lines = await findAllNoCache('Order_Lines');
    const discounted = lines.filter((l: any) => Number(l.line_discount || 0) > 0);
    console.log(`Total lines with line_discount > 0: ${discounted.length}`);
}
inspectLines();
