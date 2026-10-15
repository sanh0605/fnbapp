import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Owner answer 2026-10-15 (BR-CASH-001, spec 2026-10-15-thu-chi-de-xuat.md Q2):
 * the 53 Shopee purchase orders were paid through ACB, not in cash.
 *
 * Dry run by default. Only --apply writes:
 *   purchase_orders.payment_method -> 'BANK_TRANSFER' and bank_account_id -> the
 *   ACB account read from bank_accounts now, for every COMPLETED order of source
 *   Shopee still marked CASH. Refuses to write unless the plan is the 53 orders
 *   and 26.048.237đ the owner was shown.
 *
 * Side effect: the BEFORE UPDATE trigger touch_updated_at() moves updated_at on
 * each of those rows. Nothing else fires (no queue tables; the cash book view
 * reads the rows live). Lãi lỗ reads hand rows only, so it does not move.
 *
 * Run: npx vite-node scripts/move-shopee-orders-to-acb.ts [--apply]
 * Afterwards (read-only): verify-cash-book.ts and verify-pnl-monthly.ts, 0 lệch.
 */

const EXPECTED = { count: 53, total: 26_048_237 };
const BATCH = 50;
const apply = process.argv.includes("--apply");

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

async function main(): Promise<void> {
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { getSupabaseClient } = await import("@/lib/db/supabase");
  const { saigonToday } = await import("@/lib/shared/datetime");
  const { monthEnds, independentClosings, compareClosings, describeResult } = await import("./verify-cash-book-core");
  const { pickAcbAccount, planMove, withMove } = await import("./move-shopee-orders-to-acb-core");

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");

  async function loadRaw() {
    const [orders, payments, purchaseOrders, entries, transfers, categories] = await Promise.all([
      findAllNoCache("Orders_V2"), findAllNoCache("Order_Payments"), findAllNoCache("Purchase_Orders"),
      findAllNoCache("Cash_Entries"), findAllNoCache("Cash_Transfers"), findAllNoCache("Cash_Categories"),
    ]);
    return { orders, payments, purchaseOrders, entries, transfers, categories } as any;
  }

  const [sources, accounts, raw] = await Promise.all([
    findAllNoCache("Purchase_Sources") as Promise<{ id: string; name: string }[]>,
    findAllNoCache("Bank_Accounts") as Promise<{ id: string; name: string; status: string }[]>,
    loadRaw(),
  ]);
  const shopee = sources.filter((s) => s.name === "Shopee");
  if (shopee.length !== 1) throw new Error(`Cần đúng 1 nguồn "Shopee", tìm thấy ${shopee.length}`);
  const accountId = pickAcbAccount(accounts);
  const accountName = accounts.find((a) => a.id === accountId)!.name;

  const plan = planMove(raw.purchaseOrders, shopee[0].id);
  const shopeeAll = raw.purchaseOrders.filter((o: any) => o.source_id === shopee[0].id);
  console.log(`Nguồn Shopee ${shopee[0].id}: ${shopeeAll.length} phiếu tất cả; sẽ chuyển ${plan.targets.length} phiếu HOÀN TẤT đang "Tiền mặt".`);
  console.log(`Tài khoản nhận: ${accountId} (${accountName}).`);
  console.log(`Tổng tiền: ${fmt(plan.total)}đ trên ${plan.targets.length} phiếu.`);
  console.log(`Mã phiếu: ${plan.targets.map((t) => t.id).join(", ")}`);
  const matches = plan.targets.length === EXPECTED.count && plan.total === EXPECTED.total;
  console.log(
    matches
      ? `Khớp số chủ quán đã duyệt (${EXPECTED.count} phiếu, ${fmt(EXPECTED.total)}đ).`
      : `KHÁC số chủ quán đã duyệt (${EXPECTED.count} phiếu, ${fmt(EXPECTED.total)}đ).`,
  );

  const today = saigonToday();
  const ends = [...monthEnds("2026-03", today), today];
  const before = independentClosings(raw, ends);
  const predicted = independentClosings(
    { ...raw, purchaseOrders: withMove(raw.purchaseOrders, plan.targets.map((t) => t.id), accountId) },
    ends,
  );
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
  if (!matches) throw new Error("Số phiếu hoặc số tiền khác số đã duyệt; không ghi.");

  const supabase = getSupabaseClient();
  const ids = plan.targets.map((t) => t.id);
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("purchase_orders")
      .update({ payment_method: "BANK_TRANSFER", bank_account_id: accountId })
      .in("id", batch)
      .select("id");
    if (error) throw new Error(`purchase_orders: ${error.message}`);
    if ((data ?? []).length !== batch.length) throw new Error(`purchase_orders: ghi ${data?.length ?? 0}/${batch.length} dòng`);
  }

  // Re-read: nothing of the plan is left as cash, and every balance is the predicted one.
  const after = await loadRaw();
  const left = planMove(after.purchaseOrders, shopee[0].id).targets.length;
  const result = compareClosings(independentClosings(after, ends), predicted);
  console.log(`\nPhiếu Shopee hoàn tất còn "Tiền mặt": ${left}`);
  console.log(describeResult(result));
  if (left !== 0 || result.differences.length > 0) process.exit(1);
  console.log("OK. Chạy tiếp verify-cash-book.ts và verify-pnl-monthly.ts (chỉ đọc), yêu cầu 0 lệch.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
