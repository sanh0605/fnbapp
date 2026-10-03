import { describe, expect, it } from "vitest";
import { parseCashTransfer, type CashTransferInput } from "./cash-transfer-rules";

const ACTIVE = ["BA-001", "BA-002"];
const good: CashTransferInput = {
  transfer_date: "2026-09-10",
  amount: "5000000",
  from: "CASH",
  to: "BA-001",
  note: "  Gửi két vào ACB  ",
};

function err(over: Partial<CashTransferInput>, active = ACTIVE): string | null {
  const r = parseCashTransfer({ ...good, ...over }, active);
  return r.ok === false ? r.error : null;
}

describe("parseCashTransfer", () => {
  it("accepts a drawer to bank transfer, trims the note, maps CASH to null", () => {
    expect(parseCashTransfer(good, ACTIVE)).toEqual({
      ok: true,
      value: {
        transfer_date: "2026-09-10",
        amount: 5_000_000,
        from_account_id: null,
        to_account_id: "BA-001",
        note: "Gửi két vào ACB",
      },
    });
  });

  it("accepts bank to drawer and bank to bank", () => {
    const r1 = parseCashTransfer({ ...good, from: "BA-001", to: "CASH" }, ACTIVE);
    expect(r1.ok && r1.value.from_account_id).toBe("BA-001");
    expect(r1.ok && r1.value.to_account_id).toBeNull();
    expect(parseCashTransfer({ ...good, from: "BA-001", to: "BA-002" }, ACTIVE).ok).toBe(true);
  });

  it("accepts 150.000 as 150000", () => {
    const r = parseCashTransfer({ ...good, amount: "150.000" }, ACTIVE);
    expect(r.ok && r.value.amount).toBe(150000);
  });

  it("refuses a missing or unreal date with 'Chọn ngày chuyển'", () => {
    expect(err({ transfer_date: "" })).toBe("Chọn ngày chuyển");
    expect(err({ transfer_date: "2026-02-30" })).toBe("Chọn ngày chuyển");
    expect(err({ transfer_date: "10/09/2026" })).toBe("Chọn ngày chuyển");
  });

  it("refuses amount 0, empty and text", () => {
    expect(err({ amount: "0" })).toBe("Số tiền phải lớn hơn 0");
    expect(err({ amount: "" })).toBe("Số tiền phải lớn hơn 0");
    expect(err({ amount: "abc" })).toMatch(/^Số tiền chỉ gồm chữ số/);
    expect(err({ amount: "1,5" })).toMatch(/^Số tiền chỉ gồm chữ số/);
  });

  it("refuses CASH to CASH", () => {
    expect(err({ from: "CASH", to: "CASH" })).toBe("Nơi chuyển và nơi nhận phải khác nhau");
  });

  it("refuses the same account on both sides", () => {
    expect(err({ from: "BA-001", to: "BA-001" })).toBe("Nơi chuyển và nơi nhận phải khác nhau");
  });

  it("refuses an unknown or stopped account", () => {
    expect(err({ to: "BA-999" })).toBe("Tài khoản không còn dùng");
    expect(err({ from: "BA-001", to: "CASH" }, ["BA-002"])).toBe("Tài khoản không còn dùng");
  });

  it("refuses an empty end with its own words", () => {
    expect(err({ from: "" })).toBe("Chọn nơi chuyển");
    expect(err({ to: "" })).toBe("Chọn nơi nhận");
  });

  it("stores an empty note as an empty string (the column is not null)", () => {
    const r = parseCashTransfer({ ...good, note: "   " }, ACTIVE);
    expect(r.ok && r.value.note).toBe("");
  });
});
