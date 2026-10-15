import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Owner answer 2026-10-15: the three "Vốn góp" (CFC-005) hand rows were paid into
 * ACB (BA-001), not cash.
 *
 * Dry run by default. Only --apply writes: cash_entries.payment_method ->
 * 'BANK_TRANSFER' and bank_account_id -> BA-001, for every ACTIVE CASH row of
 * CFC-005. Refuses unless the plan is exactly the 3 ids and 35.982.207đ the owner
 * was shown. cash_entries_bank_account_check needs method and account set
 * together, which one update does.
 *
 * Side effect: BEFORE UPDATE trigger touch_updated_at() moves updated_at on the
 * 3 rows; nothing else fires. The cash balance goes negative from 26/03 (owner
 * accepted; he records a bank -> cash transfer himself).
 *
 * Run: npx vite-node scripts/move-capital-entries-to-acb.ts [--apply]
 * Afterwards (read-only): verify-cash-book.ts, 0 lệch.
 */

const CATEGORY = "CFC-005";
const ACCOUNT = "BA-001";
const EXPECTED = { ids: ["CE-001", "CE-024", "CE-040"], total: 35_982_207 };
const apply = process.argv.includes("--apply");

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

async function main(): Promise<void> {
  const { execSync } = await import("node:child_process");
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { getSupabaseClient } = await import("@/lib/db/supabase");
  const { saigonToday } = await import("@/lib/shared/datetime");
  const { monthEnds, independentClosings, compareClosings, describeResult } = await import("./verify-cash-book-core");
  const { pickAcbAccount } = await import("./move-shopee-orders-to-acb-core");
  const { planCapitalMove, withCapitalMove } = await import("./move-capital-entries-to-acb-core");

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");

  // Skill step 1: live triggers on the target table (read-only select).
  console.log("\nTrigger trên cash_entries (truy vấn máy chủ):");
  console.log(execSync(
    `npx supabase db query --linked "select tgname, pg_get_triggerdef(oid) as def from pg_trigger where tgrelid = 'public.cash_entries'::regclass and not tgisinternal"`,
    { encoding: "utf8" },
  ));

  async function loadRaw() {
    const [orders, payments, purchaseOrders, entries, transfers, categories] = await Promise.all([
      findAllNoCache("Orders_V2"), findAllNoCache("Order_Payments"), findAllNoCache("Purchase_Orders"),
      findAllNoCache("Cash_Entries"), findAllNoCache("Cash_Transfers"), findAllNoCache("Cash_Categories"),
    ]);
    return { orders, payments, purchaseOrders, entries, transfers, categories } as any;
  }

  const [accounts, raw] = await Promise.all([
    findAllNoCache("Bank_Accounts") as Promise<{ id: string; name: string; status: string }[]>,
    loadRaw(),
  ]);
  const account = accounts.find((a) => a.id === ACCOUNT);
  if (!account || account.status !== "ACTIVE") throw new Error(`Tài khoản ${ACCOUNT} không có hoặc không ACTIVE`);
  if (pickAcbAccount(accounts) !== ACCOUNT) throw new Error(`Tài khoản ACB đang dùng không phải ${ACCOUNT}`);

  const plan = planCapitalMove(raw.entries, CATEGORY);
  const ids = plan.targets.map((t) => t.id);
  console.log(`Nhóm ${CATEGORY}: ${plan.targets.length} dòng ACTIVE đang "Tiền mặt".`);
  console.log(`Tài khoản nhận: ${ACCOUNT} (${account.name}, ${account.status}).`);
  for (const t of plan.targets) console.log(`  ${t.id} | ${t.entry_date} | ${fmt(t.amount)}đ`);
  console.log(`Tổng tiền: ${fmt(plan.total)}đ trên ${ids.length} dòng.`);
  const matches = ids.join() === EXPECTED.ids.join() && plan.total === EXPECTED.total;
  console.log(
    matches
      ? `Khớp số chủ quán đã duyệt (${EXPECTED.ids.join(", ")}; ${fmt(EXPECTED.total)}đ).`
      : `KHÁC số chủ quán đã duyệt (${EXPECTED.ids.join(", ")}; ${fmt(EXPECTED.total)}đ).`,
  );

  const today = saigonToday();
  const ends = [...monthEnds("2026-03", today), today];
  const before = independentClosings(raw, ends);
  const predicted = independentClosings({ ...raw, entries: withCapitalMove(raw.entries, ids, ACCOUNT) }, ends);
  console.log("\ncuối ngày | tiền mặt trước -> dự đoán sau | ngân hàng trước -> dự đoán sau | tổng trước -> sau");
  for (const end of ends) {
    const b = before.get(end)!;
    const p = predicted.get(end)!;
    console.log(`${end} | ${fmt(b.cash)} -> ${fmt(p.cash)} | ${fmt(b.bank)} -> ${fmt(p.bank)} | ${fmt(b.total)} -> ${fmt(p.total)}`);
  }

  if (!apply) {
    console.log("\nChạy thử xong, chưa ghi gì.");
    return;
  }
  if (!matches) throw new Error("Dòng hoặc số tiền khác số đã duyệt; không ghi.");

  const { data, error } = await getSupabaseClient()
    .from("cash_entries")
    .update({ payment_method: "BANK_TRANSFER", bank_account_id: ACCOUNT })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(`cash_entries: ${error.message}`);
  if ((data ?? []).length !== ids.length) throw new Error(`cash_entries: ghi ${data?.length ?? 0}/${ids.length} dòng`);

  // Re-read: no Vốn góp row left as cash, and every balance is the predicted one.
  const after = await loadRaw();
  const left = planCapitalMove(after.entries, CATEGORY).targets.length;
  const result = compareClosings(independentClosings(after, ends), predicted);
  console.log(`\nDòng Vốn góp còn "Tiền mặt": ${left}`);
  console.log(describeResult(result));
  if (left !== 0 || result.differences.length > 0) process.exit(1);
  console.log("OK. Chạy tiếp verify-cash-book.ts (chỉ đọc), yêu cầu 0 lệch.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
