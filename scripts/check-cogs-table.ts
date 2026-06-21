/**
 * Check COGS table breakdown — verify đào miếng shows correct MAC.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { getPnLDataV2 } = require("../app/actions/reports");

(async () => {
  const pnl = await getPnLDataV2({
    startDate: "2026-06-01T00:00:00+07:00",
    endDate: "2026-06-19T23:59:59+07:00",
  });
  console.log("=== COGS table (top 20) ===");
  console.log("Ingredient | Qty | MAC/unit | COGS | %");
  const sorted = [...pnl.cogsDetails].sort((a, b) => b.cogs - a.cogs);
  for (const r of sorted.slice(0, 20)) {
    const mac = r.qty > 0 ? r.cogs / r.qty : 0;
    const pct = pnl.totalCOGS > 0 ? (r.cogs / pnl.totalCOGS * 100).toFixed(1) : "0";
    console.log(`${r.name.padEnd(30)} | ${r.qty.toFixed(2).padStart(10)} ${r.unitName} | ${Math.round(mac).toLocaleString().padStart(10)} | ${r.cogs.toLocaleString().padStart(10)} | ${pct}%`);
  }
  // Specifically đào miếng
  console.log("\n=== Đào miếng detail ===");
  const daoMieng = pnl.cogsDetails.find((r: any) => r.name && r.name.toLowerCase().includes("đào"));
  if (daoMieng) {
    const mac = daoMieng.qty > 0 ? daoMieng.cogs / daoMieng.qty : 0;
    console.log(`Name: ${daoMieng.name}`);
    console.log(`Qty: ${daoMieng.qty} ${daoMieng.unitName}`);
    console.log(`MAC: ${Math.round(mac)} đ / ${daoMieng.unitName}`);
    console.log(`Total COGS: ${daoMieng.cogs} đ`);
    console.log(`Expected MAC ~4104 (based on PO_RECEIPT 8+8+32 = 48 miếng, total 197k)`);
  }
})();
