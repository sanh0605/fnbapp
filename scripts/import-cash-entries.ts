import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeNameForComparison } from "@/lib/shared/duplicate-name-guard";

/**
 * One-time backfill of the 38 cash-book rows the owner kept by hand in a
 * Google Sheet before this app had a cash book at all.
 *
 * 16 rows are left out under BR-CASH-001 (owner decision 2026-09-11): the
 * cash book never holds purchase money. Tắc and chanh (6 rows) are already
 * entered as purchase orders PO-156, PO-160 .. PO-164. Đá viên and túi đựng
 * khoai (10 rows) are catalogued purchased items (SPM-005, SPM-146) the
 * owner chose to enter as purchase orders himself.
 *
 * See scripts/fixtures/cash-entries-2026.json for the extracted rows and
 * their provenance (why 38 of 123, and the distribution across categories),
 * and docs/superpowers/specs/2026-09-08-so-thu-chi-design.md for the cash
 * book design.
 *
 * Dry run by default; --apply writes. See main() below for the exact steps.
 *
 * Run: npx vite-node scripts/import-cash-entries.ts --bank-account=<tên tài khoản>
 *      npx vite-node scripts/import-cash-entries.ts --bank-account=<tên tài khoản> --apply
 *
 * --bank-account names the account the sheet's one BANK_TRANSFER row lands
 * in (2026-09-02, 1.728.578đ) -- that account is created on
 * /admin/finance/bank-accounts after migration 0101 ships, so its name is
 * only known at run time, never hardcoded here.
 */

export interface SheetRow {
  entry_date: string;
  category: string;
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  note: string;
}

// Exactly the columns cash_entries takes on INSERT. created_at is written
// here, unlike an ordinary screen write: these rows were recorded on the
// sheet's own dates, and defaulting them to now() would claim the owner
// entered five months of history in one afternoon. updated_at is left to
// the database.
export interface CashEntryRow {
  id: string;
  entry_date: string;
  category_id: string;
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  bank_account_id: string | null;
  payer: null;
  note: string | null;
  status: "ACTIVE";
  // Midnight Asia/Saigon on the sheet's date, as an ISO timestamp.
  created_at: string;
  created_by_id: string;
  created_by_name: string;
  updated_by_id: string;
  updated_by_name: string;
}

// "2026-09-02" -> "02/09/2026", for a Vietnamese-readable error message.
function formatDateVn(entryDate: string): string {
  const [y, m, d] = entryDate.split("-");
  return `${d}/${m}/${y}`;
}

export function buildRows(
  sheet: SheetRow[],
  categoryIds: Record<string, string>,
  actor: { id: string; name: string },
  bankAccountId: string | null,
): CashEntryRow[] {
  const sorted = [...sheet].sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0));

  return sorted.map((row, index) => {
    const category_id = categoryIds[row.category];
    if (!category_id) {
      throw new Error(
        `Không tìm thấy nhóm thu chi "${row.category}" trong bảng cash_categories -- dừng, không tự tạo nhóm mới.`,
      );
    }

    let bank_account_id: string | null = null;
    if (row.payment_method === "BANK_TRANSFER") {
      if (!bankAccountId) {
        const amountVn = row.amount.toLocaleString("vi-VN");
        throw new Error(
          `Dòng chuyển khoản ${formatDateVn(row.entry_date)} — ${amountVn}đ chưa biết vào tài khoản nào. ` +
          `Chạy lại kèm --bank-account=<tên tài khoản>.`,
        );
      }
      bank_account_id = bankAccountId;
    }

    return {
      id: `CE-${String(index + 1).padStart(3, "0")}`,
      entry_date: row.entry_date,
      category_id,
      amount: row.amount,
      payment_method: row.payment_method,
      bank_account_id,
      payer: null,
      note: row.note || null,
      status: "ACTIVE",
      created_at: `${row.entry_date}T00:00:00+07:00`,
      created_by_id: actor.id,
      created_by_name: actor.name,
      updated_by_id: actor.id,
      updated_by_name: actor.name,
    };
  });
}

// The five categories migration 0101 seeded, and the kind (chi/thu) each one
// carries there -- see supabase/migrations/0101_cash_book.sql. Hardcoded
// here rather than looked up because monthlyTotals works off already-built
// rows (category id only, no kind) and this backfill only ever touches
// these five.
const CATEGORY_KIND: Record<string, "EXPENSE" | "INCOME"> = {
  "CFC-001": "EXPENSE", // Vận hành
  "CFC-002": "EXPENSE", // Điện, nước, gas
  "CFC-003": "EXPENSE", // Marketing
  "CFC-004": "INCOME",  // Thu khác
  "CFC-005": "INCOME",  // Vốn góp
};

// { "2026-07": { "CFC-001": 1371000, ..., EXPENSE_TOTAL, INCOME_TOTAL } }
export function monthlyTotals(rows: CashEntryRow[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    const month = row.entry_date.slice(0, 7);
    if (!out[month]) out[month] = { EXPENSE_TOTAL: 0, INCOME_TOTAL: 0 };
    out[month][row.category_id] = (out[month][row.category_id] ?? 0) + row.amount;

    const kind = CATEGORY_KIND[row.category_id];
    if (kind === "INCOME") out[month].INCOME_TOTAL += row.amount;
    else out[month].EXPENSE_TOTAL += row.amount;
  }

  return out;
}

// M11 (final-review.md): mapping every category by name, INACTIVE included,
// let a retired category and its ACTIVE replacement race on the same name --
// whichever sorted last in the table won. Filter to ACTIVE so a row always
// lands on the category the owner can currently see and edit.
export function buildCategoryIdMap(
  categories: Array<{ id: string; name: string; status: string }>,
): Record<string, string> {
  const categoryIds: Record<string, string> = {};
  for (const c of categories) {
    if (c.status !== "ACTIVE") continue;
    categoryIds[c.name] = c.id;
  }
  return categoryIds;
}

// Vietnamese hint line naming the ACTIVE accounts to choose from, or saying
// there are none yet -- shown on both "flag missing" and "name not found".
function bankAccountHint(activeAccounts: Array<{ name: string }>): string {
  if (activeAccounts.length === 0) return "Chưa có tài khoản ngân hàng nào đang hoạt động.";
  return `Các tài khoản đang hoạt động: ${activeAccounts.map((a) => a.name).join(", ")}.`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const bankAccountArg = process.argv.find((a) => a.startsWith("--bank-account="));
  const bankAccountName = bankAccountArg ? bankAccountArg.slice("--bank-account=".length) : null;

  const { findAllNoCache, insertMany } = await import("@/lib/db/tables");

  const fixturePath = resolve(process.cwd(), "scripts/fixtures/cash-entries-2026.json");
  const sheet: SheetRow[] = JSON.parse(readFileSync(fixturePath, "utf8"));

  // 1. Load cash_categories, build name -> id. Stop loudly if a name the
  // sheet uses is not seeded.
  const categories = await findAllNoCache("Cash_Categories") as Array<{ id: string; name: string; status: string }>;
  const categoryIds = buildCategoryIdMap(categories);

  const neededNames = [...new Set(sheet.map((r) => r.category))];
  const missingNames = neededNames.filter((name) => !(name in categoryIds));
  if (missingNames.length > 0) {
    console.error(`Thiếu nhóm thu chi trong cash_categories: ${missingNames.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  // 2. Refuse to run twice: cash_entries must be empty before this backfill.
  const existingEntries = await findAllNoCache("Cash_Entries") as unknown[];
  if (existingEntries.length > 0) {
    console.error(
      `cash_entries đang có ${existingEntries.length} dòng -- dừng, để tránh nạp trùng ${sheet.length} dòng này lần nữa.`,
    );
    process.exitCode = 1;
    return;
  }

  // 3. Resolve the bank account the sheet's one BANK_TRANSFER row lands in,
  // BEFORE anything is printed -- the owner must see it, not guess it. Name
  // matching goes through the same normaliser the app uses for duplicate
  // names, so spacing/NBSP/case differences never cause a false "not found".
  let bankAccountId: string | null = null;
  let resolvedBankAccountName: string | null = null;
  const hasBankTransfer = sheet.some((r) => r.payment_method === "BANK_TRANSFER");
  if (hasBankTransfer) {
    const bankAccounts = await findAllNoCache("Bank_Accounts") as Array<{ id: string; name: string; status: string }>;
    const activeAccounts = bankAccounts.filter((a) => a.status === "ACTIVE");

    if (!bankAccountName) {
      console.error(
        `Có dòng chuyển khoản trong dữ liệu nhưng chưa chọn tài khoản. ` +
        `Chạy lại kèm --bank-account=<tên tài khoản>. ${bankAccountHint(activeAccounts)}`,
      );
      process.exitCode = 1;
      return;
    }

    const target = normalizeNameForComparison(bankAccountName);
    const match = activeAccounts.find((a) => normalizeNameForComparison(a.name) === target);
    if (!match) {
      console.error(
        `Không tìm thấy tài khoản "${bankAccountName}" đang hoạt động. ${bankAccountHint(activeAccounts)}`,
      );
      process.exitCode = 1;
      return;
    }
    bankAccountId = match.id;
    resolvedBankAccountName = match.name;
  }

  // 4. Actor for the audit columns: the account, not a hardcoded id.
  const users = await findAllNoCache("Users") as Array<{ id: string; name: string | null; username: string; role: string; status: string }>;
  const admin = users.find((u) => u.role === "ADMIN" && u.status === "ACTIVE");
  if (!admin) {
    console.error("Không tìm thấy tài khoản ADMIN đang hoạt động trong bảng users.");
    process.exitCode = 1;
    return;
  }
  const actor = { id: admin.id, name: admin.name || admin.username };

  // 5. Build rows and print everything before writing anything.
  const rows = buildRows(sheet, categoryIds, actor, bankAccountId);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  console.log(`\n${rows.length} dòng sẽ nạp vào cash_entries (người ghi: ${actor.name}):\n`);
  for (const r of rows) {
    const amountVn = r.amount.toLocaleString("vi-VN");
    const methodLabel = r.payment_method === "CASH"
      ? "Tiền mặt"
      : `Chuyển khoản -> ${resolvedBankAccountName}`;
    console.log(`  ${r.entry_date}  ${nameById.get(r.category_id)}  ${amountVn}đ  [${methodLabel}]  ${r.note ?? ""}`);
  }

  const totals = monthlyTotals(rows);
  console.log("\nTổng theo tháng:");
  for (const month of Object.keys(totals).sort()) {
    const t = totals[month];
    console.log(`  ${month}: chi ${t.EXPENSE_TOTAL.toLocaleString("vi-VN")}đ, thu ${t.INCOME_TOTAL.toLocaleString("vi-VN")}đ`);
  }

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
  console.log(`\nTổng cộng: ${rows.length} dòng, ${totalAmount.toLocaleString("vi-VN")}đ.`);

  // 6 / 7. Dry run stops here; --apply writes.
  if (!apply) {
    console.log("\nCHẠY THỬ -- chưa ghi gì. Thêm --apply để ghi thật.");
    return;
  }

  const written = await insertMany("Cash_Entries", rows);
  console.log(`\nĐã ghi ${written.length} / ${rows.length} dòng.`);
}

if (process.env.VITEST !== "true") {
  main().catch((error: unknown) => {
    console.error("FAILED:", error);
    process.exitCode = 1;
  });
}
