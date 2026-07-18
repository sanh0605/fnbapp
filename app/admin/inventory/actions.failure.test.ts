import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  unstableCache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: mocks.unstableCache,
}));

import { approveStockAdjustment, submitStockAdjustment } from "./actions";

type Row = Record<string, unknown>;

describe("stock adjustment forced failures", () => {
  let adjustments: Row[];
  let ledger: Row[];
  let idCounters: Record<string, number>;
  let failOnceAt: string | null;

  beforeEach(() => {
    vi.clearAllMocks();
    adjustments = [];
    ledger = [];
    idCounters = {};
    failOnceAt = null;

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => cloneRows(tableFor(sheet)));
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => cloneRows(tableFor(sheet)));
    mocks.generateNewId.mockImplementation(async (sheet: string, prefix: string) => {
      idCounters[sheet] = (idCounters[sheet] || 0) + 1;
      return `${prefix}-${idCounters[sheet]}`;
    });
    mocks.insert.mockImplementation(async (sheet: string, row: Row) => {
      const operation = `insert:${sheet}`;
      if (failOnceAt === operation) {
        failOnceAt = null;
        throw new Error(`${operation} failed`);
      }
      tableFor(sheet).push({ ...row });
    });
    mocks.update.mockImplementation(async (sheet: string, id: string, patch: Row) => {
      const operation = `update:${sheet}`;
      if (failOnceAt === operation) {
        failOnceAt = null;
        throw new Error(`${operation} failed`);
      }
      const row = tableFor(sheet).find(value => value.id === id);
      if (row) Object.assign(row, patch);
    });
  });

  describe("submitStockAdjustment", () => {
    it("leaves no rows when adjustment insert fails, then retry completes once", async () => {
      failOnceAt = "insert:Stock_Adjustments";

      const failed = await submitStockAdjustment(makeAdjustmentInput());
      expect(failed).toEqual({ error: "insert:Stock_Adjustments failed" });
      expect([adjustments.length, ledger.length]).toEqual([0, 0]);

      const retry = await submitStockAdjustment(makeAdjustmentInput());
      expect(retry).toEqual({ success: true });
      expect([adjustments.length, ledger.length]).toEqual([1, 1]);
      expect(ledger[0].reference_id).toBe(adjustments[0].id);
    });

    it("leaves an approved adjustment without ledger when ledger insert fails, then retry creates a second adjustment", async () => {
      failOnceAt = "insert:Stock_Ledger";

      const failed = await submitStockAdjustment(makeAdjustmentInput());
      expect(failed).toEqual({ error: "insert:Stock_Ledger failed" });
      expect([adjustments.length, ledger.length]).toEqual([1, 0]);
      expect(adjustments[0]).toMatchObject({ id: "SADJ-1", status: "APPROVED" });

      const retry = await submitStockAdjustment(makeAdjustmentInput());
      expect(retry).toEqual({ success: true });
      expect([adjustments.length, ledger.length]).toEqual([2, 1]);
      expect(adjustments.map(row => row.status)).toEqual(["APPROVED", "APPROVED"]);
      expect(ledger[0].reference_id).toBe("SADJ-2");
    });
  });

  describe("approveStockAdjustment", () => {
    beforeEach(() => {
      adjustments.push({
        id: "SADJ-EXISTING",
        item_reference: "ING-001",
        difference: -1,
        status: "PENDING",
      });
    });

    it("keeps the adjustment pending when approval update fails, then retry completes once", async () => {
      failOnceAt = "update:Stock_Adjustments";

      const failed = await approveStockAdjustment("SADJ-EXISTING");
      expect(failed).toEqual({ error: "update:Stock_Adjustments failed" });
      expect(adjustments[0].status).toBe("PENDING");
      expect(ledger).toHaveLength(0);

      const retry = await approveStockAdjustment("SADJ-EXISTING");
      expect(retry).toEqual({ success: true });
      expect(adjustments[0].status).toBe("APPROVED");
      expect(ledger).toHaveLength(1);
      expect(ledger[0].reference_id).toBe("SADJ-EXISTING");
    });

    it("leaves the adjustment approved without ledger when ledger insert fails and blocks retry", async () => {
      failOnceAt = "insert:Stock_Ledger";

      const failed = await approveStockAdjustment("SADJ-EXISTING");
      expect(failed).toEqual({ error: "insert:Stock_Ledger failed" });
      expect(adjustments[0].status).toBe("APPROVED");
      expect(ledger).toHaveLength(0);

      const retry = await approveStockAdjustment("SADJ-EXISTING");
      expect(retry).toEqual({ error: "Phiếu đã được duyệt" });
      expect(adjustments[0].status).toBe("APPROVED");
      expect(ledger).toHaveLength(0);
    });
  });

  function tableFor(sheet: string): Row[] {
    if (sheet === "Stock_Adjustments") return adjustments;
    if (sheet === "Stock_Ledger") return ledger;
    throw new Error(`Unexpected sheet ${sheet}`);
  }
});

function makeAdjustmentInput(): Row {
  return {
    item_id: "ING-001",
    theoretical_qty: 10,
    actual_qty: 9,
    difference: -1,
    reason: "Kiểm kê",
  };
}

function cloneRows(rows: Row[]): Row[] {
  return rows.map(row => ({ ...row }));
}
