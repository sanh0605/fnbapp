import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Read-only. Recomputes the depreciation schedule from the BR-COGS-008 rule
// (scripts/verify-depreciation-core.ts, independent of lib/assets/asset-depreciation.ts) and compares it,
// month by month and asset by asset, with the Khấu hao line of getProfitAndLossReport.
// Independence limit: price, date, term and quantity come from the same `assets` rows the app uses,
// so a wrongly entered purchase price is not caught here.

const TOLERANCE = 0.01;
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

async function main(): Promise<void> {
  const { getProfitAndLossReport } = await import("@/app/admin/reports/pnl/actions");
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { saigonToday } = await import("@/lib/shared/datetime");
  const { computeDepreciation } = await import("./verify-depreciation-core");

  const today = saigonToday().slice(0, 7);
  const [assets, disposals] = await Promise.all([findAllNoCache("assets"), findAllNoCache("asset_disposals")]);
  const { months, problems } = computeDepreciation(assets, disposals, today);

  const { availableYears } = await getProfitAndLossReport({ preset: "CUSTOM", start: `${today.slice(0, 4)}-01`, end: `${today.slice(0, 4)}-12` });
  let monthsChecked = 0;
  console.log("month   | tự tính | Lãi lỗ | lệch");
  for (const year of availableYears) {
    const { figures } = await getProfitAndLossReport({ preset: "CUSTOM", start: `${year}-01`, end: `${year}-12` });
    for (const pnl of figures.months) {
      const mine = months[pnl.month] ?? {};
      const mineTotal = Object.values(mine).reduce((s, v) => s + v, 0);
      const diff = mineTotal - pnl.depreciationExact;
      console.log(`${pnl.month} | ${fmt(mineTotal)} | ${fmt(pnl.depreciationExact)} | ${fmt(diff)}`);
      monthsChecked++;
      if (Math.abs(diff) > TOLERANCE) problems.push(`${pnl.month}: total ${mineTotal} != Lãi lỗ ${pnl.depreciationExact}`);
      const theirs = new Map(pnl.sources.depreciation.map(s => [s.id, s]));
      for (const id of new Set([...Object.keys(mine), ...theirs.keys()])) {
        const a = mine[id] ?? 0;
        const b = theirs.get(id)?.amountExact ?? 0;
        if (Math.abs(a - b) > TOLERANCE) problems.push(`${pnl.month} ${theirs.get(id)?.label ?? id} (${id}): tự tính ${a} != Lãi lỗ ${b}`);
      }
    }
  }

  const assetCount = assets.filter(a => a.status !== "INACTIVE").length;
  if (problems.length > 0) {
    console.log(`\nVERIFY-DEPRECIATION FAILED -- ${problems.length} problem(s), ${monthsChecked} tháng, ${assetCount} tài sản:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n0 lệch trên ${monthsChecked} tháng, ${assetCount} tài sản.`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
