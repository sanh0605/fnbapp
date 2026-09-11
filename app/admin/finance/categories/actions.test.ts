import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/admin/finance/categories/actions.ts"),
  "utf8",
);

describe("cash category actions", () => {
  it("guards every exported action behind an auth check", () => {
    const exported = source.match(/export async function \w+/g) ?? [];
    expect(exported.length).toBe(5);
    expect((source.match(/require(Admin|Owner)\(\)/g) ?? []).length).toBe(5);
  });

  it("lets only ADMIN delete a category permanently", () => {
    // BR-ACCESS-003: every other role may add, edit and retire -- never delete.
    expect(source).toMatch(/deleteCashCategory[\s\S]{0,200}requireOwner\(\)/);
  });

  it("stamps who created and who edited", () => {
    expect(source).toContain("creationAudit(auth.actor)");
    expect(source).toContain("updateAudit(auth.actor)");
  });

  it("never writes the timestamps by hand", () => {
    expect(source).not.toContain("created_at:");
    expect(source).not.toContain("updated_at:");
  });

  it("offers retiring as the ordinary way to stop using a category", () => {
    expect(source).toMatch(/setCashCategoryStatus[\s\S]{0,500}INACTIVE/);
  });
});

// Ruling 6 -- migration 0101's partial unique index refuses two ACTIVE
// categories sharing a name (migration 0065's normalising expression --
// lower-cased, NFC-normalised, NBSP-folded, internal whitespace collapsed),
// but its violation message is plain ASCII English, and describeActionError
// replaces any all-ASCII exception with the generic Vietnamese fallback --
// so the owner retyping a name he already has would learn nothing. The app
// must catch this itself, in Vietnamese, before the DB round trip, using
// the same lib/shared/duplicate-name-guard.ts already used by
// app/admin/inventory, app/admin/products and app/admin/suppliers.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireOwner: mocks.requireOwner,
}));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addCashCategory, updateCashCategory, deleteCashCategory, setCashCategoryStatus } from "./actions";

const ADMIN = {
  ok: true as const,
  actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" as const },
};

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("duplicate name rejection (ruling 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to add a category whose name matches an ACTIVE one case-insensitively, in Vietnamese", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", status: "ACTIVE" },
    ]);

    const result = await addCashCategory(formData({ name: "  vận HÀNH  ", kind: "EXPENSE" }));

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/[^\x00-\x7F]/); // Vietnamese, not the generic ASCII DB error
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows a name that only collides with a retired (INACTIVE) category", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-009", name: "Vận hành", status: "INACTIVE" },
    ]);
    mocks.generateNewId.mockResolvedValue("CFC-010");

    const result = await addCashCategory(formData({ name: "Vận hành", kind: "EXPENSE" }));

    expect(result.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalled();
  });

  it("lets a rename keep its own current name (excludes itself from the duplicate check)", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", status: "ACTIVE" },
    ]);

    const result = await updateCashCategory(formData({ id: "CFC-001", name: "Vận hành", kind: "EXPENSE" }));

    expect(result.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalled();
  });

  it("refuses a rename that collides with a different ACTIVE category", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", status: "ACTIVE" },
      { id: "CFC-002", name: "Marketing", status: "ACTIVE" },
    ]);

    const result = await updateCashCategory(formData({ id: "CFC-002", name: "vận hành", kind: "EXPENSE" }));

    expect(result.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  // Fix round 1: a plain trim()+toLowerCase() comparison lets a name
  // differing only by a collapsible run of internal whitespace through --
  // "Vận  hành" (two spaces) would look identical to "Vận hành" in every
  // list but be accepted as a second ACTIVE row. findDuplicateActiveName
  // (lib/shared/duplicate-name-guard.ts) collapses internal whitespace
  // (and folds NBSP, NFC-normalises) before comparing, matching migration
  // 0065's own index expression -- so this must be refused too.
  it("refuses a name that differs from an ACTIVE one only by collapsible internal whitespace", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", status: "ACTIVE" },
    ]);

    const result = await addCashCategory(formData({ name: "Vận  hành", kind: "EXPENSE" }));

    expect(result.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

// I3 -- owner decision 2026-09-11 ("Khoá, tạo nhóm mới"): a category's
// Thu/Chi side locks the moment any cash_entries row references it, even a
// cancelled one -- it is still history. affects_pnl stays editable even
// then; the form warns instead of refusing.
describe("kind is locked once a category has entries (I3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a kind change when an entry (including a cancelled one) references the category", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", status: "ACTIVE" },
    ]);
    mocks.findAllWhere.mockResolvedValue([{ id: "CE-030" }]);

    const result = await updateCashCategory(formData({ id: "CFC-001", name: "Vận hành", kind: "INCOME" }));

    expect(result.error).toBe(
      "Nhóm này đã có dòng sổ nên không đổi được bên Thu/Chi. Muốn ghi bên kia thì tạo nhóm mới.",
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.findAllWhere).toHaveBeenCalledWith(
      "Cash_Entries",
      expect.objectContaining({ eq: { category_id: "CFC-001" } }),
    );
  });

  it("allows a kind change when no entry references the category", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", status: "ACTIVE" },
    ]);
    mocks.findAllWhere.mockResolvedValue([]);

    const result = await updateCashCategory(formData({ id: "CFC-001", name: "Vận hành", kind: "INCOME" }));

    expect(result.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "Cash_Categories",
      "CFC-001",
      expect.objectContaining({ kind: "INCOME" }),
    );
  });

  it("allows an affects_pnl change even when entries are present, without checking cash_entries", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", status: "ACTIVE" },
    ]);

    const result = await updateCashCategory(formData({ id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: "on" }));

    expect(result.error).toBeUndefined();
    expect(mocks.findAllWhere).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      "Cash_Categories",
      "CFC-001",
      expect.objectContaining({ affects_pnl: true }),
    );
  });
});

// I5 -- the RESTRICT FK already refuses this delete, but Postgres's message
// is ASCII English and describeActionError genericizes it, telling the
// owner nothing. Checked here first, in Vietnamese, naming the category.
describe("permanent delete refuses a category with entries, in Vietnamese (I5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses and names the category, pointing to "Ngừng dùng"', async () => {
    mocks.requireOwner.mockResolvedValue(ADMIN);
    mocks.findAllWhere.mockResolvedValue([{ id: "CE-001" }]);
    mocks.findById.mockResolvedValue({ id: "CFC-003", name: "Marketing" });

    const result = await deleteCashCategory(formData({ id: "CFC-003" }));

    expect(result.error).toBe(
      'Nhóm "Marketing" đã có dòng sổ nên không xoá hẳn được. Bấm "Ngừng dùng" để ẩn nhóm này.',
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes a category with no entries", async () => {
    mocks.requireOwner.mockResolvedValue(ADMIN);
    mocks.findAllWhere.mockResolvedValue([]);

    const result = await deleteCashCategory(formData({ id: "CFC-004" }));

    expect(result.error).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith("Cash_Categories", "CFC-004");
  });
});

// M3 -- "Dùng lại" (reactivate) must re-check findDuplicateActiveName: another
// ACTIVE category may have taken this name while this one was retired.
describe('"Dùng lại" re-checks the duplicate-name guard (M3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to reactivate a category whose name now collides with an ACTIVE one", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Marketing", status: "INACTIVE" },
      { id: "CFC-002", name: "Marketing", status: "ACTIVE" },
    ]);

    const result = await setCashCategoryStatus(formData({ id: "CFC-001", status: "ACTIVE" }));

    expect(result.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("reactivates a category whose name is free", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-001", name: "Marketing", status: "INACTIVE" },
    ]);

    const result = await setCashCategoryStatus(formData({ id: "CFC-001", status: "ACTIVE" }));

    expect(result.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "Cash_Categories",
      "CFC-001",
      expect.objectContaining({ status: "ACTIVE" }),
    );
  });

  it("retiring (INACTIVE) never checks for duplicate names", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);

    const result = await setCashCategoryStatus(formData({ id: "CFC-001", status: "INACTIVE" }));

    expect(result.error).toBeUndefined();
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalled();
  });
});

describe("sales-revenue flag (BR-CASH-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves the flag on a new income category that counts in profit and loss", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([]);
    mocks.generateNewId.mockResolvedValue("CFC-007");

    const result = await addCashCategory(formData({
      name: "Doanh thu ghi tay 2", kind: "INCOME", affects_pnl: "on", is_sales_revenue: "on",
    }));

    expect(result.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Cash_Categories",
      expect.objectContaining({ id: "CFC-007", is_sales_revenue: true }),
    );
  });

  it("refuses the flag on an expense category, before touching the database", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);

    const result = await addCashCategory(formData({
      name: "Vận hành 2", kind: "EXPENSE", affects_pnl: "on", is_sales_revenue: "on",
    }));

    expect(result.error).toBe("Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses the flag when an edit takes the category out of profit and loss", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);

    const result = await updateCashCategory(formData({
      id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", is_sales_revenue: "on",
    }));

    expect(result.error).toBe("Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("an edit with the box unticked writes false", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: true, is_sales_revenue: true, status: "ACTIVE" },
    ]);

    const result = await updateCashCategory(formData({
      id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: "on",
    }));

    expect(result.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "Cash_Categories",
      "CFC-006",
      expect.objectContaining({ is_sales_revenue: false }),
    );
  });
});
