import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Read-only. For every month of every year the P&L page offers:
//   - POS revenue equals getPnLDataV2(month).totalRevenue;
//   - Giá vốn + Hao hụt equals getPnLDataV2(month).totalCOGS;
//   - every line's sources add up to the line.
// docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md Mục 3.

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const { getProfitAndLossReport } = await import("@/app/admin/reports/pnl/actions");
  const { getPnLDataV2 } = await import("@/app/admin/reports/actions");
  const { checkPnlMonth } = await import("./verify-pnl-monthly-core");

  const { availableYears } = await getProfitAndLossReport();
  const problems: string[] = [];
  let monthsChecked = 0;

  for (const year of availableYears) {
    const { figures } = await getProfitAndLossReport(year);
    console.log(`\n== ${year} ==`);
    console.log("month   | POS revenue | ghi tay | Giá vốn | NL dùng ngay | Hao hụt | Chi phí | Khấu hao | Thu khác");
    for (const month of figures.months) {
      const ref = await getPnLDataV2({ startDate: `${month.month}-01`, endDate: lastDayOfMonth(month.month) });
      problems.push(...checkPnlMonth(month, ref));
      monthsChecked++;
      const expenses = Object.values(month.expenseByCategory).reduce((a, b) => a + b, 0);
      console.log(
        `${month.month} | ${fmt(month.posRevenue)} | ${fmt(month.manualRevenue)} | ${fmt(month.cogsExact)} | ` +
        `${fmt(month.nonInventoryExact)} | ${fmt(month.shrinkageExact)} | ${fmt(expenses)} | ` +
        `${fmt(month.depreciationExact)} | ${fmt(month.otherIncome)}`,
      );
    }
  }

  if (problems.length > 0) {
    console.log(`\nVERIFY-PNL-MONTHLY FAILED -- ${problems.length} mismatch(es) across ${monthsChecked} month(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n0 mismatches across ${monthsChecked} month(s).`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
