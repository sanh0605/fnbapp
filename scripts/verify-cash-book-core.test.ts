import { describe, expect, it } from "vitest";
import {
  compareClosings,
  describeResult,
  independentClosings,
  monthEnds,
  type RawCashBook,
} from "./verify-cash-book-core";

const EMPTY: RawCashBook = {
  orders: [], payments: [], purchaseOrders: [], entries: [], transfers: [],
  categories: [
    { id: "CFC-001", kind: "EXPENSE" },
    { id: "CFC-005", kind: "INCOME" },
  ],
};

describe("monthEnds", () => {
  it("lists the last day of each month from the first month through the month of the given day", () => {
    expect(monthEnds("2026-03", "2026-06-10")).toEqual(["2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"]);
  });

  it("knows leap February and a year change", () => {
    expect(monthEnds("2027-12", "2028-02-01")).toEqual(["2027-12-31", "2028-01-31", "2028-02-29"]);
  });

  it("is empty when the first month is after the given day", () => {
    expect(monthEnds("2026-03", "2026-02-10")).toEqual([]);
  });
});

describe("independentClosings", () => {
  it("puts an order on its Saigon day (UTC+7), not its UTC day", () => {
    // 2026-09-30 18:00 UTC is 01:00 on 1 October in Saigon.
    const raw: RawCashBook = {
      ...EMPTY,
      orders: [{ id: "O-1", status: "COMPLETED", created_at: "2026-09-30T18:00:00+00:00", net_total: 1000, payment_method: "CASH" }],
    };
    const c = independentClosings(raw, ["2026-09-30", "2026-10-31"]);
    expect(c.get("2026-09-30")).toEqual({ cash: 0, bank: 0, total: 0 });
    expect(c.get("2026-10-31")).toEqual({ cash: 1000, bank: 0, total: 1000 });
  });

  it("counts a split order by its payment rows and a plain order by its net total; null method is cash", () => {
    const raw: RawCashBook = {
      ...EMPTY,
      orders: [
        { id: "O-1", status: "COMPLETED", created_at: "2026-09-10T03:00:00+00:00", net_total: 100, payment_method: "CASH" },
        { id: "O-2", status: "COMPLETED", created_at: "2026-09-10T03:00:00+00:00", net_total: 70, payment_method: null },
        { id: "O-3", status: "COMPLETED", created_at: "2026-09-10T03:00:00+00:00", net_total: 90, payment_method: "CASH" }, // split below
        { id: "O-4", status: "VOIDED", created_at: "2026-09-10T03:00:00+00:00", net_total: 5000, payment_method: "CASH" },
      ],
      payments: [
        { order_id: "O-3", method: "CASH", amount: 40 },
        { order_id: "O-3", method: "BANK_TRANSFER", amount: 50 },
      ],
    };
    expect(independentClosings(raw, ["2026-09-30"]).get("2026-09-30")).toEqual({ cash: 210, bank: 50, total: 260 });
  });

  it("subtracts completed purchase orders on transaction_date (created_at when missing) and ignores drafts", () => {
    const raw: RawCashBook = {
      ...EMPTY,
      purchaseOrders: [
        { id: "PO-1", status: "COMPLETED", transaction_date: "2026-09-15T03:00:00+00:00", created_at: "2026-09-20T03:00:00+00:00", total_amount: 300, payment_method: "CASH" },
        { id: "PO-2", status: "COMPLETED", transaction_date: null, created_at: "2026-09-16T03:00:00+00:00", total_amount: 200, payment_method: "BANK_TRANSFER" },
        { id: "PO-3", status: "DRAFT", transaction_date: null, created_at: "2026-09-16T03:00:00+00:00", total_amount: 999, payment_method: null },
      ],
    };
    expect(independentClosings(raw, ["2026-09-30"]).get("2026-09-30")).toEqual({ cash: -300, bank: -200, total: -500 });
  });

  it("skips cancelled hand rows and transfers, signs hand rows by category kind, moves transfers between sides", () => {
    const raw: RawCashBook = {
      ...EMPTY,
      entries: [
        { entry_date: "2026-09-02", category_id: "CFC-005", amount: 700, payment_method: "CASH", status: "ACTIVE" },
        { entry_date: "2026-09-03", category_id: "CFC-001", amount: 200, payment_method: "BANK_TRANSFER", status: "ACTIVE" },
        { entry_date: "2026-09-04", category_id: "CFC-001", amount: 9999, payment_method: "CASH", status: "CANCELLED" },
        { entry_date: "2026-09-05", category_id: "CFC-404", amount: 9999, payment_method: "CASH", status: "ACTIVE" }, // unknown category
      ],
      transfers: [
        { transfer_date: "2026-09-10", amount: 300, from_account_id: null, to_account_id: "BA-001", status: "ACTIVE" },
        { transfer_date: "2026-09-11", amount: 9999, from_account_id: null, to_account_id: "BA-001", status: "CANCELLED" },
      ],
    };
    expect(independentClosings(raw, ["2026-09-30"]).get("2026-09-30")).toEqual({ cash: 400, bank: 100, total: 500 });
  });

  it("reproduces the September 2026 closing figures", () => {
    const raw: RawCashBook = {
      ...EMPTY,
      orders: [
        // before September: cash 5.000.000 in, bank 30.000.000 in
        { id: "A-1", status: "COMPLETED", created_at: "2026-08-20T03:00:00+00:00", net_total: 5_000_000, payment_method: "CASH" },
        { id: "A-2", status: "COMPLETED", created_at: "2026-08-21T03:00:00+00:00", net_total: 30_000_000, payment_method: "BANK_TRANSFER" },
        // September
        { id: "S-1", status: "COMPLETED", created_at: "2026-09-15T03:00:00+00:00", net_total: 11_226_000, payment_method: "CASH" },
        { id: "S-2", status: "COMPLETED", created_at: "2026-09-16T03:00:00+00:00", net_total: 4_216_000, payment_method: "BANK_TRANSFER" },
      ],
      purchaseOrders: [
        { id: "PO-A", status: "COMPLETED", transaction_date: "2026-08-22T03:00:00+00:00", created_at: "", total_amount: 15_341_000, payment_method: "CASH" },
        { id: "PO-B", status: "COMPLETED", transaction_date: "2026-08-23T03:00:00+00:00", created_at: "", total_amount: 6_243_422, payment_method: "BANK_TRANSFER" },
        { id: "PO-S", status: "COMPLETED", transaction_date: "2026-09-15T03:00:00+00:00", created_at: "", total_amount: 9_043_287, payment_method: "CASH" },
      ],
      entries: [
        { entry_date: "2026-09-02", category_id: "CFC-005", amount: 2_443_400, payment_method: "CASH", status: "ACTIVE" },
        { entry_date: "2026-09-03", category_id: "CFC-001", amount: 1_637_000, payment_method: "CASH", status: "ACTIVE" },
      ],
    };
    const c = independentClosings(raw, ["2026-08-31", "2026-09-30"]);
    expect(c.get("2026-08-31")).toEqual({ cash: -10_341_000, bank: 23_756_578, total: 13_415_578 });
    expect(c.get("2026-09-30")).toEqual({ cash: -7_351_887, bank: 27_972_578, total: 20_620_691 });
  });
});

describe("compareClosings and describeResult", () => {
  const fig = (cash: number, bank: number) => ({ cash, bank, total: cash + bank });

  it("reports 0 lệch with its denominator when everything agrees", () => {
    const a = new Map([["2026-03-31", fig(1, 2)], ["2026-04-30", fig(3, 4)]]);
    const r = compareClosings(a, new Map(a));
    expect(r.differences).toEqual([]);
    expect(r.months).toBe(2);
    expect(describeResult(r)).toBe("0 lệch trên 2 tháng × 3 số");
  });

  it("lists each differing figure with both sides", () => {
    const app = new Map([["2026-03-31", fig(1, 2)]]);
    const indep = new Map([["2026-03-31", fig(1, 5)]]);
    const r = compareClosings(app, indep);
    expect(r.differences).toEqual([
      { monthEnd: "2026-03-31", figure: "bank", app: 2, independent: 5 },
      { monthEnd: "2026-03-31", figure: "total", app: 3, independent: 6 },
    ]);
    expect(describeResult(r)).toContain("2 lệch trên 1 tháng × 3 số");
    expect(describeResult(r)).toContain("2026-03-31");
  });

  it("flags a month one side does not have", () => {
    const r = compareClosings(new Map([["2026-03-31", fig(1, 1)]]), new Map());
    expect(r.differences.length).toBeGreaterThan(0);
  });
});
