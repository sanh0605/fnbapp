import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  revalidatePath: vi.fn(),
  openStocktakeSessionAtomic: vi.fn(),
  saveStocktakeLineAtomic: vi.fn(),
  cancelStocktakeSessionAtomic: vi.fn(),
  applyStocktakeSessionAtomic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/stocktake-transaction", () => ({
  openStocktakeSessionAtomic: mocks.openStocktakeSessionAtomic,
  saveStocktakeLineAtomic: mocks.saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic: mocks.cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic: mocks.applyStocktakeSessionAtomic,
}));

import * as stocktakeActions from "./actions";

describe("stocktake confirmation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  it("exposes separate admin actions for preview and explicit confirmation", () => {
    expect(stocktakeActions).toHaveProperty("getStocktakeConfirmPreview");
    expect(stocktakeActions).toHaveProperty("confirmStocktakeSession");
  });

  it("rejects a preview response that is not a dry run", async () => {
    mocks.applyStocktakeSessionAtomic.mockResolvedValue({
      sessionId: "STK-001",
      status: "CONFIRMED",
      dryRun: false,
      ledgerCount: 0,
      rows: [],
      ledgerIds: [],
    });

    await expect(stocktakeActions.getStocktakeConfirmPreview("STK-001")).resolves.toEqual({
      error: "Stocktake preview did not return a dry run",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses confirmation without a preview hash before calling the RPC", async () => {
    await expect(stocktakeActions.confirmStocktakeSession("STK-001", "")).resolves.toEqual({
      error: "Stocktake preview is required before confirmation",
    });
    expect(mocks.applyStocktakeSessionAtomic).not.toHaveBeenCalled();
  });
});
