import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-off read-only trace for ING-003 (Sữa đặc), requested via
 * docs/handoffs/2026-06-25-codex-handoff-active-task-tracking.md
 * (2026-07-29 entry: "trace why Sữa đặc (ING-003) is 6.4kg negative").
 *
 * Prints every Stock_Ledger row for ING-003 in chronological order with a
 * running balance after each row, and reports the first row where the
 * running balance crosses negative. Read-only: no database writes, no
 * corrections. Reads real data backwards from the symptom, per the
 * handoff's explicit instruction not to conclude before this trace exists.
 */

const ITEM_REFERENCE = "ING-003";

interface StockLedgerRow {
  id: string;
  item_reference: string;
  transaction_type: string;
  quantity_change: number | string;
  unit_cost: number | string;
  reference_id: string;
  source: string;
  notes: string;
  created_at: string;
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Đang tải dữ liệu...");
  const [ledger, baseIngredients] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
  ]) as [StockLedgerRow[], Array<Record<string, unknown>>];

  const ingredient = baseIngredients.find(row => String(row.id) === ITEM_REFERENCE);
  const ingredientName = ingredient ? String(ingredient.name || ITEM_REFERENCE) : ITEM_REFERENCE;

  const rows = ledger
    .filter(row => row.item_reference === ITEM_REFERENCE)
    .sort((a, b) => {
      const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  console.log("");
  console.log(`=== DÒ NGƯỢC SỔ CÁI: ${ingredientName} (${ITEM_REFERENCE}) ===`);
  console.log(`Tổng số dòng: ${rows.length}`);
  console.log("");

  let runningBalance = 0;
  let firstNegativeRow: (StockLedgerRow & { runningBalance: number; rowIndex: number }) | null = null;
  const trace: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const delta = Number(row.quantity_change) || 0;
    const balanceBefore = runningBalance;
    runningBalance += delta;

    const crossesNegative = balanceBefore >= 0 && runningBalance < 0;
    if (crossesNegative && !firstNegativeRow) {
      firstNegativeRow = { ...row, runningBalance, rowIndex: index };
    }

    const marker = crossesNegative ? ">> " : "   ";
    console.log(
      `${marker}[${index + 1}] ${row.created_at} | ${row.transaction_type} | ref=${row.reference_id || "(trống)"} | ` +
        `thay đổi=${delta} | tồn sau=${runningBalance.toFixed(3)}`,
    );

    trace.push({
      index: index + 1,
      created_at: row.created_at,
      transaction_type: row.transaction_type,
      reference_id: row.reference_id,
      source: row.source,
      notes: row.notes,
      quantity_change: delta,
      running_balance: runningBalance,
    });
  });

  console.log("");
  console.log(`Tồn cuối cùng (tính từ toàn bộ sổ cái): ${runningBalance.toFixed(3)}`);
  console.log("");

  if (firstNegativeRow) {
    const row = firstNegativeRow as StockLedgerRow & { runningBalance: number; rowIndex: number };
    console.log("=== DÒNG ĐẦU TIÊN LÀM TỒN KHO ÂM ===");
    console.log(`Thứ tự: dòng thứ ${row.rowIndex + 1} trong tổng số ${rows.length} dòng`);
    console.log(`Thời điểm: ${row.created_at}`);
    console.log(`Loại giao dịch: ${row.transaction_type}`);
    console.log(`Tham chiếu nguồn (reference_id): ${row.reference_id || "(trống)"}`);
    console.log(`Nguồn (source): ${row.source || "(trống)"}`);
    console.log(`Ghi chú: ${row.notes || "(trống)"}`);
    console.log(`Thay đổi tại dòng này: ${Number(row.quantity_change)}`);
    console.log(`Tồn kho sau dòng này: ${row.runningBalance.toFixed(3)}`);
  } else {
    console.log("Không có dòng nào làm tồn kho chuyển từ dương/0 sang âm trong toàn bộ lịch sử.");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outputPath = path.join("docs", "audits", `${stamp}-ing003-sua-dac-ledger-trace.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        itemReference: ITEM_REFERENCE,
        ingredientName,
        rowCount: rows.length,
        finalBalance: runningBalance,
        firstNegativeRow,
        trace,
      },
      null,
      2,
    ),
  );
  console.log("");
  console.log(`Đã ghi chi tiết: ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
