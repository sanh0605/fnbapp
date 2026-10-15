import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: vi.fn() }));
vi.mock("@/lib/db/tables", () => ({
  findAllWhere: vi.fn(),
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  remove: vi.fn(),
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./categories/actions", () => ({ getCashCategories: vi.fn() }));
vi.mock("./bank-accounts/actions", () => ({ getBankAccounts: vi.fn() }));
vi.mock("./transfers/actions", () => ({ getCashTransfers: vi.fn() }));
vi.mock("@/lib/finance/cash-book-daily", () => ({ readCashBookDaily: vi.fn() }));

import { addCashEntry, updateCashEntry } from "./actions";

const actor = { id: "u1", name: "Chủ quán", role: "ADMIN" };
const ROWS: Record<string, Record<string, unknown>> = {
  "Cash_Categories:CFC-001": { id: "CFC-001", status: "ACTIVE" },
  "Cash_Categories:CFC-OLD": { id: "CFC-OLD", status: "INACTIVE" },
  "Bank_Accounts:BA-001": { id: "BA-001", status: "ACTIVE" },
  "Bank_Accounts:BA-OLD": { id: "BA-OLD", status: "INACTIVE" },
};
const EXISTING = {
  id: "CE-1", status: "ACTIVE", category_id: "CFC-OLD", payment_method: "BANK_TRANSFER",
  bank_account_id: "BA-OLD", monthly_item_id: null,
};

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = {
    id: "CE-1", entry_date: "2026-10-01", category_id: "CFC-001", amount: "500000", payment_method: "CASH", ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor });
  mocks.generateNewId.mockResolvedValue("CE-9");
  mocks.findById.mockImplementation(async (sheet: string, id: string) =>
    sheet === "Cash_Entries" ? EXISTING : ROWS[`${sheet}:${id}`] ?? null,
  );
});

describe("hand row group and account (R6)", () => {
  it("add refuses a missing or stopped group", async () => {
    for (const category_id of ["CFC-404", "CFC-OLD"]) {
      expect(await addCashEntry(form({ category_id }))).toEqual({ error: "Nhóm thu chi không còn dùng" });
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("add refuses a missing or stopped account on a bank transfer, and ignores it on cash", async () => {
    for (const bank_account_id of ["BA-404", "BA-OLD"]) {
      expect(await addCashEntry(form({ payment_method: "BANK_TRANSFER", bank_account_id })))
        .toEqual({ error: "Tài khoản không còn dùng" });
    }
    expect(mocks.insert).not.toHaveBeenCalled();
    expect((await addCashEntry(form({ bank_account_id: "BA-OLD" }))).success).toBe(true);
  });

  it("update lets the row keep its own stopped group and account", async () => {
    const res = await updateCashEntry(
      form({ category_id: "CFC-OLD", payment_method: "BANK_TRANSFER", bank_account_id: "BA-OLD", note: "doi ghi chu" }),
    );
    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("update still refuses a different stopped group or account", async () => {
    mocks.findById.mockImplementation(async (sheet: string, id: string) =>
      sheet === "Cash_Entries"
        ? { ...EXISTING, category_id: "CFC-001", bank_account_id: "BA-001" }
        : ROWS[`${sheet}:${id}`] ?? null,
    );
    expect(await updateCashEntry(form({ category_id: "CFC-OLD" }))).toEqual({ error: "Nhóm thu chi không còn dùng" });
    expect(await updateCashEntry(form({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-OLD" })))
      .toEqual({ error: "Tài khoản không còn dùng" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("a row written by an asset disposal (BR-COGS-008)", () => {
  const DISPOSAL_ROW = { ...EXISTING, entry_date: "2026-10-01", category_id: "CFC-001", payment_method: "CASH", bank_account_id: null, asset_disposal_id: "TL-003" };
  beforeEach(() => {
    mocks.findById.mockImplementation(async (sheet: string, id: string) =>
      sheet === "Cash_Entries" ? DISPOSAL_ROW : ROWS[`${sheet}:${id}`] ?? null,
    );
  });

  it("cannot change its group", async () => {
    ROWS["Cash_Categories:CFC-009"] = { id: "CFC-009", status: "ACTIVE" };
    const res = await updateCashEntry(form({ category_id: "CFC-009" }));
    expect(res).toEqual({ error: "Dòng này ghi từ thanh lý tài sản, không đổi nhóm được" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cannot change its date: money and the disposal's depreciation stay in the same month", async () => {
    const res = await updateCashEntry(form({ category_id: "CFC-001", entry_date: "2026-10-02" }));
    expect(res).toEqual({ error: "Dòng này ghi từ thanh lý tài sản, không đổi ngày được" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("can still change amount and note, and an edit never touches asset_disposal_id", async () => {
    const res = await updateCashEntry(form({ category_id: "CFC-001", amount: "1300000", note: "Sửa số tiền" }));
    expect(res.success).toBe(true);
    const payload = mocks.update.mock.calls[0][2];
    expect(payload).toMatchObject({ amount: 1_300_000, note: "Sửa số tiền" });
    expect(payload).not.toHaveProperty("asset_disposal_id");
  });
});
