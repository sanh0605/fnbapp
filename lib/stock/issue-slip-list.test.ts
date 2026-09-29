import { describe, expect, it } from "vitest";
import { listIssueSlipsPage } from "./issue-slip-list";
import type { IssueRowRecord, IssueSlipRecord, StocktakeSessionRecord } from "./issue-slip-status";

const line = (id: string, slip: string | null, item: string, qty: number, at: string, over: Partial<IssueRowRecord> = {}): IssueRowRecord => ({
  id, purchased_item_id: item, issued_at: at, base_quantity: qty, source: "MANUAL", session_id: null,
  note: null, created_at: null, reverses_issue_id: null, issue_slip_id: slip, ...over,
});
const slips: IssueSlipRecord[] = [
  { id: "ISL-00076", issued_at: "2026-09-28T11:20:00Z", note: "Khác", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:21:58Z" },
  { id: "ISL-00077", issued_at: "2026-09-29T03:22:00Z", note: "Khác", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:22:25Z" },
  { id: "ISL-00041", issued_at: "2026-07-09T14:49:00Z", note: "Hao hụt / hư hỏng", created_by_id: "USR-001", created_by_name: "admin", created_at: "2026-09-01T14:49:57Z" },
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
const sessions: StocktakeSessionRecord[] = [{ id: "STK-001", status: "CONFIRMED", confirmed_at: "2026-08-09T15:02:00Z", confirmed_by_name: "admin" }];
const items = [
  { id: "SPM-038", name: "Sữa yến mạch Oatside" }, { id: "SPM-070", name: "Giấy lót chống tràn" },
  { id: "SPM-012", name: "Sữa đặc La rosee" }, { id: "SPM-067", name: "Baking Soda Caster" },
  { id: "SPM-002", name: "Sữa tươi Mlekovita" }, { id: "SPM-003", name: "Bột cà phê MR.PHIN Robusta Dak Mil" },
];
const lineValues = new Map<string, number>([
  ["ISS-00192", 73606.1633], ["ISS-00196", 36404.6], ["ISS-00197", 42493.2898],
  ["ISS-00119", 48600], ["ISS-00122", -48600], ["ISS-00001", 13550], ["ISS-00002", -2000],
]);
const page = (filters = {}) => listIssueSlipsPage({ slips, issues, sessions, items, lineValues, filters });

describe("listIssueSlipsPage", () => {
  it("Tất cả hides cancelled slips and lists the stocktake, newest first", () => {
    const p = page();
    expect(p.rows.map(r => r.id)).toEqual(["ISL-00077", "ISL-00076", "STK-001"]);
    expect(p.total).toBe(3);
  });

  it("slip value is the sum of its active lines, rounded for display", () => {
    expect(page().rows.find(r => r.id === "ISL-00076")!.value).toBe(110011);
  });

  it("stocktake value counts the shortfall only (3A) and links to the stocktake screen", () => {
    const stk = page().rows.find(r => r.id === "STK-001")!;
    expect(stk).toMatchObject({ kind: "STOCKTAKE", value: 13550, createdByName: "admin", href: "/admin/inventory/stocktake" });
  });

  it("Đã huỷ shows only cancelled slips, at 0đ", () => {
    expect(page({ kind: "CANCELLED" }).rows).toEqual([expect.objectContaining({ id: "ISL-00041", kind: "CANCELLED", value: 0 })]);
  });

  it("a surplus-only stocktake is not listed (2A); an undone one is not listed (1A)", () => {
    const surplusOnly = listIssueSlipsPage({ slips: [], issues: issues.filter(i => i.id === "ISS-00002"), sessions, items, lineValues, filters: {} });
    expect(surplusOnly.rows).toEqual([]);
    const undone = listIssueSlipsPage({ slips: [], issues, sessions: [{ ...sessions[0], status: "REVERSED" }], items, lineValues, filters: {} });
    expect(undone.rows).toEqual([]);
  });

  it("searches item names, including a cancelled slip's lines", () => {
    expect(page({ q: "oatside" }).rows.map(r => r.id)).toEqual(["ISL-00076"]);
    expect(page({ q: "baking", kind: "CANCELLED" }).rows.map(r => r.id)).toEqual(["ISL-00041"]);
  });

  it("filters by person and lists every person once", () => {
    expect(page({ person: "admin" }).rows.map(r => r.id)).toEqual(["STK-001"]);
    expect(page().people).toEqual(["admin", "tuyen2612"]);
  });

  it("a from-date after the to-date is an error and does not filter", () => {
    const p = page({ from: "2026-09-29", to: "2026-09-01" });
    expect(p.rangeError).toBe(true);
    expect(p.total).toBe(3);
  });

  it("pages 20 rows and clamps an out-of-range page", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...slips[0], id: `ISL-9${String(i).padStart(4, "0")}` }));
    const manyLines = many.map((s, i) => line(`ISS-9${i}`, s.id, "SPM-038", 1, s.issued_at));
    const p = listIssueSlipsPage({ slips: many, issues: manyLines, sessions: [], items, lineValues: new Map(), filters: { page: "9" } });
    expect(p).toMatchObject({ page: 3, pageCount: 3, firstIndex: 41, lastIndex: 45, total: 45 });
  });
});
