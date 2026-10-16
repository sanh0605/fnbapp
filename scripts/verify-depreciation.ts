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
// NaN must count as a mismatch, so test "within tolerance" and negate.
const differs = (a: number, b: number) => !(Math.abs(a - b) <= TOLERANCE);

async function main(): Promise<void> {
  const { getProfitAndLossReport } = await import("@/app/admin/reports/pnl/actions");
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { saigonToday } = await import("@/lib/shared/datetime");
  const { computeDepreciation } = await import("./verify-depreciation-core");

  const today = saigonToday().slice(0, 7);
  const [assets, disposals] = await Promise.all([findAllNoCache("assets"), findAllNoCache("asset_disposals")]);
  const { months, problems } = computeDepreciation(assets, disposals);
  for (const p of problems) console.log(`Dữ liệu tài sản không dùng được -- ${p}`);

  const compared: string[] = [];
  const pnlByAsset = new Map<string, number>();
  console.log("month   | tự tính | Lãi lỗ | lệch");
  try {
    const { availableYears } = await getProfitAndLossReport({ preset: "CUSTOM", start: `${today.slice(0, 4)}-01`, end: `${today.slice(0, 4)}-12` });
    for (const year of availableYears) {
      const { figures } = await getProfitAndLossReport({ preset: "CUSTOM", start: `${year}-01`, end: `${year}-12` });
      for (const pnl of figures.months) {
        const mine = months[pnl.month] ?? {};
        const mineTotal = Object.values(mine).reduce((s, v) => s + v, 0);
        const diff = mineTotal - pnl.depreciationExact;
        console.log(`${pnl.month} | ${fmt(mineTotal)} | ${fmt(pnl.depreciationExact)} | ${fmt(diff)}`);
        compared.push(pnl.month);
        if (differs(mineTotal, pnl.depreciationExact)) problems.push(`${pnl.month}: total ${mineTotal} != Lãi lỗ ${pnl.depreciationExact}`);
        const theirs = new Map(pnl.sources.depreciation.map(s => [s.id, s]));
        for (const s of theirs.values()) pnlByAsset.set(s.id, (pnlByAsset.get(s.id) ?? 0) + s.amountExact);
        for (const id of new Set([...Object.keys(mine), ...theirs.keys()])) {
          const a = mine[id] ?? 0;
          const b = theirs.get(id)?.amountExact ?? 0;
          if (differs(a, b)) problems.push(`${pnl.month} ${theirs.get(id)?.label ?? id} (${id}): tự tính ${a} != Lãi lỗ ${b}`);
        }
      }
    }
  } catch (err) {
    console.log(`\nBáo cáo Lãi lỗ báo lỗi, không so được (thường do tài sản có số liệu không hợp lệ): ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  // A month our schedule charges (up to today) that Lãi lỗ never returned is a mismatch too.
  const comparedSet = new Set(compared);
  for (const m of Object.keys(months)) {
    if (m <= today && !comparedSet.has(m)) problems.push(`${m}: tự tính có khấu hao nhưng Lãi lỗ không trả về tháng này`);
  }

  // Life total per asset: what Lãi lỗ charged over the compared months + our charges after the last of them = total_cost.
  const lastCompared = compared.reduce((a, b) => (b > a ? b : a), "");
  const live = assets.filter(a => a.status !== "INACTIVE");
  let lifeBad = 0;
  for (const a of live) {
    const after = Object.entries(months).reduce((s, [m, byAsset]) => (m > lastCompared ? s + (byAsset[a.id] ?? 0) : s), 0);
    const life = (pnlByAsset.get(a.id) ?? 0) + after;
    if (differs(life, Number(a.total_cost))) {
      lifeBad++;
      problems.push(`${a.name_snapshot} (${a.id}): cả đời ${life} != total_cost ${a.total_cost}`);
    }
  }

  if (compared.length === 0) problems.push("không so được tháng nào (Lãi lỗ không trả về tháng nào)");
  if (problems.length > 0) {
    console.log(`\nVERIFY-DEPRECIATION FAILED -- ${problems.length} problem(s), ${compared.length} tháng, ${live.length} tài sản, ${lifeBad} tài sản lệch tổng cả đời:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n0 lệch trên ${compared.length} tháng, ${live.length} tài sản; tổng cả đời 0 lệch trên ${live.length} tài sản.`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
