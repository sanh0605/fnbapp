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

import * as actions from "./actions";

// Batch 1, item A, section A5: "a cross-table pair stays legal: creating a
// base_ingredients row named Da vien while SPM-005 exists must succeed."
// This exercises the real addBaseIngredient action with mocked I/O, not a
// source grep (OPEN-ITEMS 38) -- the caller passes only Base_Ingredients'
// own rows to the guard, so a purchased_items collision is invisible to it
// by construction, and this proves that end to end.
describe("addBaseIngredient -- duplicate-name guard (Batch 1, section A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("NNL-999");
  });

  it("a cross-table name collision stays legal -- Base_Ingredients has no row to conflict with", async () => {
    // Base_Ingredients' own rows contain no "Da vien" -- the fact that
    // purchased_items' SPM-005 is also named "Da vien" is never fetched
    // here and cannot block this save, matching section A1's scope rule.
    mocks.findAll.mockResolvedValue([
      { id: "ING-010", name: "Duong trang", status: "ACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("name", "Da vien");
    formData.set("base_unit", "UNT-017");

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Base_Ingredients",
      expect.objectContaining({ name: "Da vien" }),
    );
  });

  it("refuses a within-table collision against an ACTIVE row, naming it in the message", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "ING-033", name: "Sữa yến mạch", status: "ACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("name", "  SỮA  YẾN MẠCH  ");
    formData.set("base_unit", "UNT-017");

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toContain("Sữa yến mạch");
    expect(res.error).toContain("ING-033");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows reusing a retired (INACTIVE) row's name -- retirement makes it reusable (section A4)", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "NNL-004", name: "Sữa yến mạch", status: "INACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("name", "Sữa yến mạch");
    formData.set("base_unit", "UNT-017");

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalled();
  });

  it("bulk import refuses two new rows in the same batch sharing a name, before writing either", async () => {
    mocks.findAll.mockResolvedValue([]);

    const formData = new FormData();
    formData.set(
      "items_json",
      JSON.stringify([
        { name: "Tra xanh", base_unit: "UNT-017", is_non_inventory: false },
        { name: "Tra Xanh", base_unit: "UNT-017", is_non_inventory: false },
      ]),
    );

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toContain("Dòng 2");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

// Batch 1, item A, section A3b/A5. "Level 2 needs both of its outcomes
// proved, not just one" -- a level-2 implementation that only ever refuses
// is level 1 wearing a prompt, and the "Thạch dứa" case is what proves it
// is not: it warns and then SAVES.
describe("addBaseIngredient -- level 2, diacritic-stripped warning (section A3b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("NNL-999");
  });

  it("'Ca phe' against an existing 'Cà phê' warns, and does not save without confirmation", async () => {
    mocks.findAll.mockResolvedValue([{ id: "ING-050", name: "Cà phê", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("name", "Ca phe");
    formData.set("base_unit", "UNT-017");

    const res: any = await actions.addBaseIngredient(formData);

    expect(res.error).toBeUndefined(); // a warning is not a refusal
    expect(res.needsDuplicateWarning).toBeTruthy();
    expect(res.needsDuplicateWarning.conflictId).toBe("ING-050");
    expect(res.needsDuplicateWarning.conflictName).toBe("Cà phê");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("'Ca phe' declined ('tôi gõ nhầm') -- the caller simply never resubmits with confirmation, nothing is saved", async () => {
    // Modelling "tôi gõ nhầm": the owner does not resubmit at all. Nothing
    // beyond the warning response above is needed to prove this side --
    // repeated here as its own case so both outcomes of section A5 are
    // each their own test, not inferred from one.
    mocks.findAll.mockResolvedValue([{ id: "ING-050", name: "Cà phê", status: "ACTIVE" }]);
    const formData = new FormData();
    formData.set("name", "Ca phe");
    formData.set("base_unit", "UNT-017");

    await actions.addBaseIngredient(formData);

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("'Thạch dứa' against the existing 'Thạch dừa' (NNL-009) warns, then SAVES on confirmation ('món khác'), recording it", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NNL-009", name: "Thạch dừa", status: "ACTIVE" }]);

    const firstAttempt = new FormData();
    firstAttempt.set("name", "Thạch dứa");
    firstAttempt.set("base_unit", "UNT-017");
    const warned: any = await actions.addBaseIngredient(firstAttempt);
    expect(warned.needsDuplicateWarning).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();

    // "món khác" -- the owner confirms it really is a different item, the
    // form resubmits with the confirmation flag set.
    const confirmedAttempt = new FormData();
    confirmedAttempt.set("name", "Thạch dứa");
    confirmedAttempt.set("base_unit", "UNT-017");
    confirmedAttempt.set("duplicate_warning_confirmed", "true");
    const saved = await actions.addBaseIngredient(confirmedAttempt);

    expect(saved.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Base_Ingredients",
      expect.objectContaining({
        name: "Thạch dứa",
        duplicate_warning_confirmed: true,
        duplicate_warning_confirmed_by: "Admin",
      }),
    );
  });

  it("'Da vien' against 'Đá viên' reaches level 2 -- proves đ/Đ are stripped explicitly, not missed by NFD alone", async () => {
    mocks.findAll.mockResolvedValue([{ id: "ING-001", name: "Đá viên", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("name", "Da vien");
    formData.set("base_unit", "UNT-017");

    const res: any = await actions.addBaseIngredient(formData);

    expect(res.needsDuplicateWarning).toBeTruthy();
    expect(res.needsDuplicateWarning.conflictId).toBe("ING-001");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("a genuine exact match still hits level 1 (refuse), never level 2", async () => {
    mocks.findAll.mockResolvedValue([{ id: "ING-050", name: "Cà phê", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("name", "cà phê"); // level-1 match (case-fold only, same diacritics)
    formData.set("base_unit", "UNT-017");

    const res: any = await actions.addBaseIngredient(formData);

    expect(res.error).toBeTruthy(); // refused outright, not a warning
    expect(res.needsDuplicateWarning).toBeUndefined();
  });
});

describe("updateBaseIngredient -- duplicate-name guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("excludes the row's own id -- saving without changing the name is not a self-collision", async () => {
    mocks.findAll.mockResolvedValue([{ id: "ING-033", name: "Sữa yến mạch", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("id", "ING-033");
    formData.set("name", "Sữa yến mạch");
    formData.set("base_unit", "UNT-017");

    const res = await actions.updateBaseIngredient(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalled();
  });

  it("refuses renaming a row to collide with a different ACTIVE row", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "ING-033", name: "Sữa yến mạch", status: "ACTIVE" },
      { id: "ING-010", name: "Duong trang", status: "ACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("id", "ING-010");
    formData.set("name", "Sữa yến mạch");
    formData.set("base_unit", "UNT-017");

    const res = await actions.updateBaseIngredient(formData);

    expect(res.error).toContain("ING-033");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
