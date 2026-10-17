import { describe, expect, it } from "vitest";
import { buildStaffNameResolver } from "@/lib/auth/staff-names";
import { listIssueSlipsPage } from "./issue-slip-list";
import type { IssueRowRecord, IssueSlipRecord } from "./issue-slip-status";

const line = (id: string, slip: string | null, item: string, qty: number, at: string, over: Partial<IssueRowRecord> = {}): IssueRowRecord => ({
  id, purchased_item_id: item, issued_at: at, base_quantity: qty, source: "MANUAL", session_id: null,
  note: null, created_at: null, reverses_issue_id: null, issue_slip_id: slip, ...over,
});
const slips: IssueSlipRecord[] = [
  { id: "ISL-00076", issued_at: "2026-09-28T11:20:00Z", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:21:58Z" },
  { id: "ISL-00077", issued_at: "2026-09-29T03:22:00Z", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:22:25Z" },
  { id: "ISL-00041", issued_at: "2026-07-09T14:49:00Z", created_by_id: "USR-001", created_by_name: "admin", created_at: "2026-09-01T14:49:57Z" },
];
const issues: IssueRowRecord[] = [
  line("ISS-00192", "ISL-00076", "SPM-038", 2000, "2026-09-28T11:20:00Z"),
  line("ISS-00196", "ISL-00076", "SPM-070", 1, "2026-09-28T11:20:00Z"),
  line("ISS-00197", "ISL-00077", "SPM-012", 1000, "2026-09-29T03:22:00Z"),
  line("ISS-00119", "ISL-00041", "SPM-067", 454, "2026-07-09T14:49:00Z"),
  line("ISS-00122", null, "SPM-067", -454, "2026-09-01T19:25:45Z", { reverses_issue_id: "ISS-00119", note: "Đảo phiếu ISS-00119 (ghi nhầm) -- Huỷ cả phiếu ISL-00041 -- Test" }),
  line("ISS-00001", null, "SPM-002", 500, "2026-08-09T15:02:00Z", { source: "STOCKTAKE", session_id: "STK-001" }),
  line("ISS-00002", null, "SPM-003", -20, "2026-08-09T15:02:00Z", { source: "STOCKTAKE", session_id: "STK-001" }),
];
const items = [
  { id: "SPM-038", name: "Sữa yến mạch Oatside" }, { id: "SPM-070", name: "Giấy lót chống tràn" },
  { id: "SPM-012", name: "Sữa đặc La rosee" }, { id: "SPM-067", name: "Baking Soda Caster" },
  { id: "SPM-002", name: "Sữa tươi Mlekovita" }, { id: "SPM-003", name: "Bột cà phê MR.PHIN Robusta Dak Mil" },
];
const lineValues = new Map<string, number>([
  ["ISS-00192", 73606.1633], ["ISS-00196", 36404.6], ["ISS-00197", 42493.2898],
  ["ISS-00119", 48600], ["ISS-00122", -48600], ["ISS-00001", 13550], ["ISS-00002", -2000],
]);
const staffName = buildStaffNameResolver([
  { id: "USR-001", username: "admin", name: "ADMIN" },
  { id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" },
]);
const page = (filters = {}) => listIssueSlipsPage({ slips, issues, items, lineValues, filters, staffName });

describe("listIssueSlipsPage", () => {
  it("Tất cả hides cancelled slips and lists no stocktake row (BR-INV-022), newest first", () => {
    const p = page();
    expect(p.rows.map(r => r.id)).toEqual(["ISL-00077", "ISL-00076"]);
    expect(p.total).toBe(2);
    expect(p.totals.value).toBe(Math.round(42493.2898 + 73606.1633 + 36404.6));
  });

  it("a row carries no reason (the slip has no note column after 0136)", () => {
    expect(page({ kind: "CANCELLED" }).rows[0]).not.toHaveProperty("reason");
  });

  it("slip value is the sum of its active lines, rounded for display", () => {
    expect(page().rows.find(r => r.id === "ISL-00076")!.value).toBe(110011);
  });

  it("Đã huỷ shows only cancelled slips, at 0đ", () => {
    expect(page({ kind: "CANCELLED" }).rows).toEqual([expect.objectContaining({ id: "ISL-00041", kind: "CANCELLED", value: 0 })]);
  });

  it("searches item names, including a cancelled slip's lines", () => {
    expect(page({ q: "oatside" }).rows.map(r => r.id)).toEqual(["ISL-00076"]);
    expect(page({ q: "baking", kind: "CANCELLED" }).rows.map(r => r.id)).toEqual(["ISL-00041"]);
  });

  it("shows the staff name, not the stored login, and lists every person once", () => {
    expect(page().rows.map(r => r.createdByName)).toEqual(["Tài Chí Tuyền", "Tài Chí Tuyền"]);
    expect(page().people).toEqual(["ADMIN", "Tài Chí Tuyền"]);
  });

  it("filters by the staff name shown in the person list", () => {
    expect(page({ person: "Tài Chí Tuyền" }).rows.map(r => r.id)).toEqual(["ISL-00077", "ISL-00076"]);
    expect(page({ person: "tuyen2612" }).rows).toEqual([]);
  });

  it("keeps the stored text for a person missing from users", () => {
    const p = listIssueSlipsPage({ slips, issues, items, lineValues, filters: {}, staffName: buildStaffNameResolver([]) });
    expect(p.rows.map(r => r.createdByName)).toEqual(["tuyen2612", "tuyen2612"]);
  });

  it("a from-date after the to-date is an error and does not filter", () => {
    const p = page({ from: "2026-09-29", to: "2026-09-01" });
    expect(p.rangeError).toBe(true);
    expect(p.total).toBe(2);
  });

  it("pages 20 rows and clamps an out-of-range page", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...slips[0], id: `ISL-9${String(i).padStart(4, "0")}` }));
    const manyLines = many.map((s, i) => line(`ISS-9${i}`, s.id, "SPM-038", 1, s.issued_at));
    const p = listIssueSlipsPage({ slips: many, issues: manyLines, items, lineValues: new Map(), filters: { page: "9" }, staffName });
    expect(p).toMatchObject({ page: 3, pageCount: 3, firstIndex: 41, lastIndex: 45, total: 45 });
  });
});

describe("listIssueSlipsPage totals (BR-UI-004)", () => {
  // 21 live slips (20 on page 1, 1 beyond) of 100,4đ each, plus a cancelled slip.
  const many: IssueSlipRecord[] = Array.from({ length: 21 }, (_, i) => ({
    id: `ISL-${String(200 + i)}`, issued_at: `2026-09-${String(i + 1).padStart(2, "0")}T05:00:00Z`,
    created_by_id: "USR-001", created_by_name: "admin", created_at: null,
  }));
  const manyIssues: IssueRowRecord[] = [
    ...many.map((s, i) => line(`ISS-${300 + i}`, s.id, "SPM-038", 1, s.issued_at)),
    line("ISS-400", "ISL-041", "SPM-067", 1, "2026-09-02T05:00:00Z"),
    line("ISS-401", null, "SPM-067", -1, "2026-09-03T05:00:00Z", { reverses_issue_id: "ISS-400" }),
  ];
  const cancelledSlip: IssueSlipRecord = {
    id: "ISL-041", issued_at: "2026-09-02T05:00:00Z", created_by_id: "USR-001", created_by_name: "admin", created_at: null,
  };
  const values = new Map<string, number>([["ISS-400", 99999], ["ISS-401", -99999]]);
  many.forEach((_, i) => values.set(`ISS-${300 + i}`, 100.4));
  const run = (filters = {}) => listIssueSlipsPage({
    slips: [...many, cancelledSlip], issues: manyIssues, items, lineValues: values, filters, staffName,
  });

  it("totals every live slip the filter matches, rounded once from the exact sum", () => {
    const p = run();
    expect(p.rows).toHaveLength(20);
    // 21 x 100.4 = 2108.4 -> 2108 (not 21 x 100 = 2100)
    expect(p.totals).toEqual({ count: 21, value: 2108 });
  });

  it("leaves cancelled slips out of the total even on the Đã huỷ filter", () => {
    expect(run({ kind: "CANCELLED" }).totals).toEqual({ count: 0, value: 0 });
  });

  it("follows the same filter as the rows", () => {
    expect(run({ from: "2026-09-01", to: "2026-09-02" }).totals).toEqual({ count: 2, value: 201 });
  });
});
