import { describe, expect, it } from "vitest";
import { parseCashEntry, summariseEntries, parseSalesRevenueFlag, SALES_REVENUE_FLAG_ERROR } from "./cash-entry-rules";
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

  it.each(["0", "000", ""])("rejects amount %s as not greater than zero", (amount) => {
    expect(parseCashEntry({ ...valid, amount }))
      .toEqual({ ok: false, error: "Số tiền phải lớn hơn 0" });
  });

  // I1 (final-review.md): "150.000" typed the Vietnamese way for one hundred
  // fifty thousand was silently read as 150 by Number("150.000") -- a 1000x
  // understatement with no warning. Only digits, or dot-separated groups of
  // exactly three digits, are accepted now; the dot means "thousands
  // separator" and nothing else -- no decimal point, no comma, no
  // scientific or hex notation, no malformed grouping.
  const AMOUNT_FORMAT_ERROR =
    "Số tiền chỉ gồm chữ số; dấu chấm chỉ dùng để chia hàng nghìn (ví dụ 150.000)";
  it.each(["1500.5", "150,000", "1e6", "0x10", "-5", "abc", "1.50.000", "-5000"])(
    "rejects amount %s as the wrong format, not as non-positive",
    (amount) => {
      expect(parseCashEntry({ ...valid, amount }))
        .toEqual({ ok: false, error: AMOUNT_FORMAT_ERROR });
    },
  );

  it.each([
    ["250000", 250000],
    ["150.000", 150000],
    [" 150.000 ", 150000],
    ["1.371.000", 1371000],
  ])("accepts %s as %i dong", (amount, expected) => {
    const r = parseCashEntry({ ...valid, amount });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amount).toBe(expected);
  });

  it("rejects an amount too large to represent safely, distinctly from a non-positive one", () => {
    expect(parseCashEntry({ ...valid, amount: "99999999999999999999" }))
      .toEqual({ ok: false, error: "Số tiền quá lớn" });
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

describe("parseSalesRevenueFlag (BR-CASH-006)", () => {
  it("accepts the flag on an income category that counts in profit and loss", () => {
    expect(parseSalesRevenueFlag("INCOME", true, true)).toEqual({ ok: true, value: true });
  });

  it("refuses it on an expense category", () => {
    expect(parseSalesRevenueFlag("EXPENSE", true, true)).toEqual({ ok: false, error: SALES_REVENUE_FLAG_ERROR });
  });

  it("refuses it on an income category kept out of profit and loss (capital)", () => {
    expect(parseSalesRevenueFlag("INCOME", false, true)).toEqual({ ok: false, error: SALES_REVENUE_FLAG_ERROR });
  });

  it("an unticked box is always fine and saves false", () => {
    expect(parseSalesRevenueFlag("EXPENSE", false, false)).toEqual({ ok: true, value: false });
  });

  it("says why in Vietnamese", () => {
    expect(SALES_REVENUE_FLAG_ERROR).toBe(
      "Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.",
    );
  });
});
