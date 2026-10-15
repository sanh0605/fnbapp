import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { planPaymentRow } from "./add-missing-order-payment-core";

/**
 * 6d batch 1a: order 260723001017 (COMPLETED, 25.000đ, cash) has no payment
 * row. Adds that one row to order_payments (no triggers, no updated_at).
 * No other table is touched; no queue or automation reads order_payments
 * rows as they arrive.
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/add-missing-order-payment.ts [--apply]
 */

const ORDER_NO = "260723001017";
const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const { data: orders, error } = await supabase
    .from("orders_v2").select("id,order_no,status,payment_method,net_total,created_at")
    .eq("order_no", ORDER_NO).eq("status", "COMPLETED");
  if (error) throw new Error(`orders_v2: ${error.message}`);
  if (orders.length !== 1) throw new Error(`Expected 1 COMPLETED order ${ORDER_NO}, found ${orders.length}`);
  const order = orders[0];

  const { data: existing, error: pErr } = await supabase.from("order_payments").select("order_id").eq("order_id", order.id);
  if (pErr) throw new Error(`order_payments: ${pErr.message}`);

  const row = planPaymentRow(order, existing);
  console.log(`1 dòng sẽ thêm vào order_payments cho đơn ${ORDER_NO}:`, JSON.stringify(row));
  if (!apply) { console.log("Chạy thử xong, chưa ghi gì."); return; }

  const { error: insErr } = await supabase.from("order_payments").insert(row);
  if (insErr) throw new Error(`insert: ${insErr.message}`);
  const { data: after, error: aErr } = await supabase.from("order_payments").select("amount").eq("order_id", order.id);
  if (aErr) throw new Error(`re-read: ${aErr.message}`);
  const sum = after.reduce((s, p) => s + p.amount, 0);
  console.log(sum === order.net_total ? `OK: tiền thanh toán ${sum} = ${order.net_total}` : `LỆCH: ${sum} khác ${order.net_total}`);
  if (sum !== order.net_total) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
