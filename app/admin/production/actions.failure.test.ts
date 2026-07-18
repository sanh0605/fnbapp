import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveProductionOrder } from "./actions";

type Row = Record<string, unknown>;

describe("saveProductionOrder forced failures", () => {
  let productionOrders: Row[];
  let productionItems: Row[];
  let ledger: Row[];
  let idCounters: Record<string, number>;
  let failOnceAt: string | null;

  beforeEach(() => {
    vi.clearAllMocks();
    productionOrders = [];
    productionItems = [];
    ledger = [];
    idCounters = {};
    failOnceAt = null;

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Semi_Products") return [{ id: "BTP-001", name: "Cốt cà phê" }];
      return [];
    });
    mocks.generateNewId.mockImplementation(async (sheet: string, prefix: string) => {
      idCounters[sheet] = (idCounters[sheet] || 0) + 1;
      return `${prefix}-${idCounters[sheet]}`;
    });
    mocks.insert.mockImplementation(async (sheet: string, row: Row) => {
      const operation = sheet === "Stock_Ledger"
        ? `insert:${sheet}:${String(row.transaction_type)}`
        : `insert:${sheet}`;
      if (failOnceAt === operation) {
        failOnceAt = null;
        throw new Error(`${operation} failed`);
      }
      tableFor(sheet).push({ ...row });
    });
  });

  it("leaves no mutation when the first production-order insert fails and permits a clean retry", async () => {
    failOnceAt = "insert:Production_Orders";

    const failed = await saveProductionOrder(makeFormData());
    expect(failed).toEqual({ error: "insert:Production_Orders failed" });
    expect(productionOrders).toHaveLength(0);
    expect(productionItems).toHaveLength(0);
    expect(ledger).toHaveLength(0);

    const retry = await saveProductionOrder(makeFormData());
    expect(retry.success).toBe(true);
    expect(productionOrders).toHaveLength(1);
    expect(productionItems).toHaveLength(1);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_CONSUME")).toHaveLength(1);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_YIELD")).toHaveLength(1);
  });

  it("leaves an orphan order and creates a second order when item insert fails and the operator retries", async () => {
    failOnceAt = "insert:Production_Items";

    const failed = await saveProductionOrder(makeFormData());
    expect(failed).toEqual({ error: "insert:Production_Items failed" });
    expect(productionOrders).toHaveLength(1);
    expect(productionItems).toHaveLength(0);
    expect(ledger).toHaveLength(0);

    const retry = await saveProductionOrder(makeFormData());
    expect(retry.success).toBe(true);
    expect(productionOrders).toHaveLength(2);
    expect(productionItems).toHaveLength(1);
    expect(ledger).toHaveLength(2);
  });

  it("leaves an order and item without ledger rows when consume insert fails, then creates a second complete order on retry", async () => {
    failOnceAt = "insert:Stock_Ledger:PRODUCTION_CONSUME";

    const failed = await saveProductionOrder(makeFormData());
    expect(failed).toEqual({ error: "insert:Stock_Ledger:PRODUCTION_CONSUME failed" });
    expect(productionOrders).toHaveLength(1);
    expect(productionItems).toHaveLength(1);
    expect(ledger).toHaveLength(0);

    const retry = await saveProductionOrder(makeFormData());
    expect(retry.success).toBe(true);
    expect(productionOrders).toHaveLength(2);
    expect(productionItems).toHaveLength(2);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_CONSUME")).toHaveLength(1);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_YIELD")).toHaveLength(1);
  });

  it("silently doubles ingredient consumption when yield insert fails and the operator retries", async () => {
    failOnceAt = "insert:Stock_Ledger:PRODUCTION_YIELD";

    const failed = await saveProductionOrder(makeFormData());
    expect(failed).toEqual({ error: "insert:Stock_Ledger:PRODUCTION_YIELD failed" });
    expect(productionOrders).toHaveLength(1);
    expect(productionItems).toHaveLength(1);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_CONSUME")).toHaveLength(1);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_YIELD")).toHaveLength(0);

    const retry = await saveProductionOrder(makeFormData());
    expect(retry.success).toBe(true);
    expect(productionOrders).toHaveLength(2);
    expect(productionItems).toHaveLength(2);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_CONSUME")).toHaveLength(2);
    expect(ledger.filter(row => row.transaction_type === "PRODUCTION_YIELD")).toHaveLength(1);
  });

  function tableFor(sheet: string): Row[] {
    if (sheet === "Production_Orders") return productionOrders;
    if (sheet === "Production_Items") return productionItems;
    if (sheet === "Stock_Ledger") return ledger;
    throw new Error(`Unexpected sheet ${sheet}`);
  }
});

function makeFormData(): FormData {
  const formData = new FormData();
  formData.set("semi_product_id", "BTP-001");
  formData.set("target_yield", "100");
  formData.set("consumed_ingredients", JSON.stringify([{
    ingredient_id: "ING-001",
    qtyNeeded: 20,
    is_non_inventory: false,
  }]));
  formData.set("user", "Quản lý");
  return formData;
}
