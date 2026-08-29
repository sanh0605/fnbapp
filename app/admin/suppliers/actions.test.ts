import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { addSupplier, editSupplier, getSuppliers } from "./actions";

function baseFormData(name: string): FormData {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

// docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md
// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getSuppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty list", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getSuppliers()).rejects.toThrow("db down");
  });

  it("a genuinely empty Suppliers table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getSuppliers()).resolves.toEqual([]);
  });
});

describe("addSupplier -- duplicate-name guard (Batch 1 follow-up, level 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("NCC-999");
  });

  // Also the plan section 5 requirement that a message already written for
  // the owner survives lib/action-error.ts's wrapper: this returns via
  // `return fail(duplicateNameErrorMessage(conflict))` from inside the try
  // block, which exits before the catch that now calls describeActionError
  // could ever touch it -- proven here by the exact message still showing
  // up untouched, not a generic sentence.
  it("refuses a within-table collision against an ACTIVE row, naming it", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NCC-010", name: "Công ty ABC", status: "ACTIVE" }]);

    const res = await addSupplier(baseFormData("  Công ty  ABC  "));

    expect(res.error).toContain("Công ty ABC");
    expect(res.error).toContain("NCC-010");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

// Batch 1 follow-up, level 2 (section A3b, BR-CATALOG-001), wired into
// Suppliers the same way as Base_Ingredients.
describe("addSupplier -- level 2, diacritic-stripped warning (Batch 1 follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("NCC-999");
  });

  it("'Cong ty ABC' against an existing 'Công ty ABC' warns, and does not save on decline", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NCC-010", name: "Công ty ABC", status: "ACTIVE" }]);

    const res: any = await addSupplier(baseFormData("Cong ty ABC"));

    expect(res.error).toBeUndefined();
    expect(res.needsDuplicateWarning).toBeTruthy();
    expect(res.needsDuplicateWarning.conflictId).toBe("NCC-010");
    expect(mocks.insert).not.toHaveBeenCalled();

    // "tôi gõ nhầm" -- no resubmission with the confirmation flag, so
    // nothing beyond the warning above is needed to prove decline.
  });

  it("a genuinely different name that strips the same warns, then SAVES on confirmation ('món khác'), recording it", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NCC-009", name: "Nhà Vườn Dừa", status: "ACTIVE" }]);

    const warned: any = await addSupplier(baseFormData("Nhà Vườn Dứa"));
    expect(warned.needsDuplicateWarning).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();

    const confirmedFormData = baseFormData("Nhà Vườn Dứa");
    confirmedFormData.set("duplicate_warning_confirmed", "true");
    const saved: any = await addSupplier(confirmedFormData);

    expect(saved.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Suppliers",
      expect.objectContaining({
        name: "Nhà Vườn Dứa",
        duplicate_warning_confirmed: true,
        duplicate_warning_confirmed_by: "Admin",
      }),
    );
  });

  it("an exact match (case-fold only, same diacritics) still hits level 1 (refuse), never level 2", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NCC-010", name: "Công ty ABC", status: "ACTIVE" }]);

    const res: any = await addSupplier(baseFormData("công ty abc"));

    expect(res.error).toBeTruthy();
    expect(res.needsDuplicateWarning).toBeUndefined();
  });
});

describe("editSupplier -- level 2, diacritic-stripped warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("excludes the row's own id from the collision check", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NCC-010", name: "Công ty ABC", status: "ACTIVE" }]);
    const formData = baseFormData("Cong ty ABC");
    formData.set("id", "NCC-010");

    const res: any = await editSupplier(formData);

    expect(res.error).toBeUndefined();
    expect(res.needsDuplicateWarning).toBeUndefined();
    expect(mocks.update).toHaveBeenCalled();
  });
});
