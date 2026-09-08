import { describe, expect, it } from "vitest";
import { parseCashEntry, summariseEntries } from "./cash-entry-rules";
import type { DBCashCategory, DBCashEntry } from "@/types/db";

const valid = {
  entry_date: "2026-07-15",
  category_id: "CFC-001",
  amount: "150000",
  payment_method: "CASH",
  bank_account_id: "",
  note: "Mua ly giấy",
};

describe("parseCashEntry", () => {
  it("accepts a well-formed cash entry and returns a whole number of dong", () => {
    const r = parseCashEntry(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amount).toBe(150000);
    expect(r.value.bank_account_id).toBeNull();
  });

  it("rejects a missing date in Vietnamese", () => {
    expect(parseCashEntry({ ...valid, entry_date: "" }))
      .toEqual({ ok: false, error: "Chọn ngày ghi sổ" });
  });

  it("rejects a missing category in Vietnamese", () => {
    expect(parseCashEntry({ ...valid, category_id: "" }))
      .toEqual({ ok: false, error: "Chọn nhóm thu chi" });
  });

  it.each(["0", "-5000", "", "abc", "1500.5"])("rejects amount %s", (amount) => {
    expect(parseCashEntry({ ...valid, amount }))
      .toEqual({ ok: false, error: "Số tiền phải lớn hơn 0" });
  });

  it("requires a bank account when the money moved by transfer", () => {
    expect(parseCashEntry({ ...valid, payment_method: "BANK_TRANSFER", bank_account_id: "" }))
      .toEqual({ ok: false, error: "Chuyển khoản phải chọn tài khoản" });
  });

  it("drops a stale bank account when the method is cash", () => {
    const r = parseCashEntry({ ...valid, payment_method: "CASH", bank_account_id: "BA-001" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.bank_account_id).toBeNull();
  });

  it("turns a blank note into null rather than an empty string", () => {
    const r = parseCashEntry({ ...valid, note: "   " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.note).toBeNull();
  });
});

const cats = [
  { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true },
  { id: "CFC-004", name: "Thu khác", kind: "INCOME", affects_pnl: true },
  { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false },
] as DBCashCategory[];

const entry = (id: string, category_id: string, amount: number, status = "ACTIVE") =>
  ({ id, category_id, amount, status, entry_date: "2026-07-15" } as DBCashEntry);

describe("summariseEntries", () => {
  it("keeps income and expense apart and never adds them together", () => {
    const s = summariseEntries(
      [entry("CE-001", "CFC-001", 1371000), entry("CE-002", "CFC-004", 200000)],
      cats,
    );
    expect(s.totalExpense).toBe(1371000);
    expect(s.totalIncome).toBe(200000);
    expect(s).not.toHaveProperty("net");
  });

  it("splits out the income that is not revenue", () => {
    const s = summariseEntries(
      [entry("CE-001", "CFC-004", 200000), entry("CE-002", "CFC-005", 5000000)],
      cats,
    );
    expect(s.totalIncome).toBe(5200000);
    expect(s.incomeOutsidePnl).toBe(5000000);
  });

  it("leaves cancelled rows out of every total", () => {
    const s = summariseEntries(
      [entry("CE-001", "CFC-001", 1371000), entry("CE-002", "CFC-001", 999000, "CANCELLED")],
      cats,
    );
    expect(s.totalExpense).toBe(1371000);
  });

  it("groups by category so the July acceptance figure can be read off", () => {
    const s = summariseEntries(
      [entry("CE-001", "CFC-001", 1371000), entry("CE-002", "CFC-001", 1)],
      cats,
    );
    expect(s.byCategory).toEqual([
      { categoryId: "CFC-001", name: "Vận hành", kind: "EXPENSE", total: 1371001 },
    ]);
  });

  it("does not crash on an entry whose category is missing from the list", () => {
    const s = summariseEntries([entry("CE-001", "CFC-999", 1000)], cats);
    expect(s.totalExpense).toBe(0);
    expect(s.totalIncome).toBe(0);
    expect(s.unknownCategoryIds).toEqual(["CFC-999"]);
  });
});
