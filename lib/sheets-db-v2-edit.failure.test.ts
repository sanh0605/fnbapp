import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
  removeMany: vi.fn(),
}));

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  insertMany: mocks.insertMany,
  update: mocks.update,
  remove: vi.fn(),
  removeMany: mocks.removeMany,
}));

import {
  supersedeOrderV2,
  type SupersedeOrderV2Input,
} from "./sheets-db-v2-edit";

type Row = Record<string, unknown>;
type MutableState = {
  orders: Row[];
  lines: Row[];
  events: Row[];
  ledger: Row[];
};

describe("supersedeOrderV2 forced failures", () => {
  let state: MutableState;
  let failOnceAt: string | null;
  let cleanupFailOnceAt: string | null;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      orders: [{ id: "ord-old", status: "COMPLETED", version: 1, superseded_by: "" }],
      lines: [],
      events: [],
      ledger: [],
    };
    failOnceAt = null;
    cleanupFailOnceAt = null;

    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") return cloneRows(state.orders);
      return [];
    });
    mocks.update.mockImplementation(async (sheet: string, id: string, patch: Row) => {
      maybeFail(`update:${sheet}`);
      const row = tableFor(sheet).find(value => value.id === id);
      if (row) Object.assign(row, patch);
    });
    mocks.insert.mockImplementation(async (sheet: string, row: Row) => {
      maybeFail(`insert:${sheet}`);
      insertUnique(tableFor(sheet), row);
    });
    mocks.insertMany.mockImplementation(async (sheet: string, rows: Row[]) => {
      maybeFail(`insertMany:${sheet}`);
      for (const row of rows) insertUnique(tableFor(sheet), row);
    });
    mocks.removeMany.mockImplementation(async (sheet: string, ids: string[]) => {
      if (cleanupFailOnceAt === `removeMany:${sheet}`) {
        cleanupFailOnceAt = null;
        throw new Error(`${sheet} cleanup failed`);
      }
      const table = tableFor(sheet);
      for (let index = table.length - 1; index >= 0; index -= 1) {
        if (ids.includes(String(table[index].id))) table.splice(index, 1);
      }
    });
  });

  it.each([
    "update:Orders_V2",
    "insert:Orders_V2",
    "insertMany:Order_Lines_V2",
    "insert:Order_Events",
    "insertMany:Stock_Ledger",
  ])("restores the initial state after a single failure at %s and permits retry", async failurePoint => {
    failOnceAt = failurePoint;

    const failed = await supersedeOrderV2(makeInput());

    expect(failed.success).toBe(false);
    expect(state).toEqual(initialState());

    const retry = await supersedeOrderV2(makeInput());

    expect(retry).toEqual({ success: true });
    expect(state.orders).toEqual([
      expect.objectContaining({ id: "ord-old", status: "SUPERSEDED", superseded_by: "ord-new" }),
      expect.objectContaining({ id: "ord-new", status: "COMPLETED" }),
    ]);
    expect(state.lines).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.ledger).toHaveLength(2);
  });

  it("leaves orphan lines and makes retry fail when line cleanup itself fails", async () => {
    failOnceAt = "insert:Order_Events";
    cleanupFailOnceAt = "removeMany:Order_Lines_V2";

    const failed = await supersedeOrderV2(makeInput());

    expect(failed.success).toBe(false);
    expect(state.orders).toEqual(initialState().orders);
    expect(state.lines).toEqual([expect.objectContaining({ id: "line-new" })]);
    expect(state.events).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);

    const retry = await supersedeOrderV2(makeInput());

    expect(retry.success).toBe(false);
    expect(state.orders).toEqual(initialState().orders);
    expect(state.lines).toEqual([expect.objectContaining({ id: "line-new" })]);
  });

  function maybeFail(operation: string): void {
    if (failOnceAt !== operation) return;
    failOnceAt = null;
    throw new Error(`${operation} failed`);
  }

  function tableFor(sheet: string): Row[] {
    if (sheet === "Orders_V2") return state.orders;
    if (sheet === "Order_Lines_V2") return state.lines;
    if (sheet === "Order_Events") return state.events;
    if (sheet === "Stock_Ledger") return state.ledger;
    throw new Error(`Unexpected sheet ${sheet}`);
  }
});

function makeInput(): SupersedeOrderV2Input {
  return {
    oldOrderId: "ord-old",
    expectedOldVersion: 1,
    newOrder: {
      id: "ord-new",
      status: "COMPLETED",
      version: 2,
      parent_order_id: "ord-old",
    } as SupersedeOrderV2Input["newOrder"],
    newLines: [{ id: "line-new", order_id: "ord-new" }] as SupersedeOrderV2Input["newLines"],
    event: { id: "event-edit", order_id: "ord-new", event_type: "EDITED" } as SupersedeOrderV2Input["event"],
    reversalEntries: [{
      id: "ledger-reversal",
      transaction_type: "EDIT_REVERSAL",
      reference_id: "ord-old",
      item_reference: "ING-001",
      quantity_change: 10,
      unit_cost: 100,
      created_at: "2026-07-19T00:00:00.000Z",
      order_event_id: "event-edit",
      cost_at_sale: 1_000,
    }],
    consumeEntries: [{
      id: "ledger-consume",
      transaction_type: "SALES_CONSUME",
      reference_id: "ord-new",
      item_reference: "ING-001",
      quantity_change: -12,
      unit_cost: 100,
      created_at: "2026-07-19T00:00:00.000Z",
      order_event_id: "event-edit",
      cost_at_sale: 1_200,
    }],
  };
}

function initialState(): MutableState {
  return {
    orders: [{ id: "ord-old", status: "COMPLETED", version: 1, superseded_by: "" }],
    lines: [],
    events: [],
    ledger: [],
  };
}

function insertUnique(table: Row[], row: Row): void {
  if (table.some(value => value.id === row.id)) {
    throw new Error(`duplicate key ${String(row.id)}`);
  }
  table.push({ ...row });
}

function cloneRows(rows: Row[]): Row[] {
  return rows.map(row => ({ ...row }));
}
