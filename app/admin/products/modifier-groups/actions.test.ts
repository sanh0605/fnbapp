import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  saveModifierGroupAtomic: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findById: mocks.findById,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
  getCacheTag: (sheet: string) => `sheets-${sheet}`,
}));
vi.mock("@/lib/products/modifier-group-transaction", () => ({ saveModifierGroupAtomic: mocks.saveModifierGroupAtomic }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: mocks.revalidateTag }));

import {
  deleteModifierGroup,
  getModifierGroup,
  getModifierGroups,
  saveModifierGroup,
  setModifierGroupStatus,
  updateModifierGroup,
} from "./actions";

const actor = { id: "a-1", name: "Admin", role: "ADMIN" };
const form = (fields: Record<string, string>, productIds: string[] = []) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const id of productIds) fd.append("product_ids", id);
  return fd;
};

const GROUPS = [
  { id: "MG-001", name: "Thêm Topping", selection_mode: "MANY", max_total: null, allow_standalone: true, sort_order: 50, status: "ACTIVE" },
  { id: "MG-002", name: "Mức đường", selection_mode: "ONE", max_total: null, allow_standalone: false, sort_order: 1, status: "ACTIVE" },
];
const OPTIONS = [
  { id: "MOD-004", name: "Trân châu trắng", group_id: "MG-001", status: "ACTIVE", product_id: "PROD-031" },
  { id: "MOD-002", name: "Kem muối", group_id: "MG-001", status: "ACTIVE", product_id: null },
  { id: "MOD-007", name: "Cũ", group_id: "MG-001", status: "DELETED", product_id: "PROD-035" },
  { id: "MOD-010", name: "Ít đường", group_id: "MG-002", status: "ACTIVE", product_id: null },
];
const LINKS = [
  { id: "MG-001:PROD-001", group_id: "MG-001", product_id: "PROD-001" },
  { id: "MG-001:PROD-002", group_id: "MG-001", product_id: "PROD-002" },
];

const valid = { name: "Loại sữa", selection_mode: "ONE", sort_order: "3" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor });
  mocks.requireOwner.mockResolvedValue({ ok: true, actor });
  mocks.generateNewId.mockResolvedValue("MG-003");
  mocks.saveModifierGroupAtomic.mockImplementation(async (i: any) => ({ groupId: i.group.id, productCount: i.productIds.length }));
  mocks.findAll.mockImplementation(async (sheet: string) =>
    sheet === "Modifier_Groups" ? GROUPS : sheet === "Modifiers" ? OPTIONS : sheet === "Modifier_Group_Products" ? LINKS : [],
  );
});

describe("reading groups", () => {
  it("lists groups by Thứ tự hiện then name, with live option names and dish counts", async () => {
    const rows = await getModifierGroups();
    expect(rows.map((r) => r.group.name)).toEqual(["Mức đường", "Thêm Topping"]);
    const topping = rows[1];
    expect(topping.optionNames).toEqual(["Trân châu trắng", "Kem muối"]);
    expect(topping.productCount).toBe(2);
  });

  it("returns one group with its options and ticked dishes, or null", async () => {
    mocks.findById.mockResolvedValue(GROUPS[0]);
    const one = await getModifierGroup("MG-001");
    expect(one?.options.map((o) => o.id)).toEqual(["MOD-004", "MOD-002"]);
    expect(one?.productIds).toEqual(["PROD-001", "PROD-002"]);
    mocks.findById.mockResolvedValue(null);
    expect(await getModifierGroup("MG-999")).toBeNull();
  });
});

describe("saveModifierGroup", () => {
  it("requires a name and refuses a duplicate ignoring case", async () => {
    expect(await saveModifierGroup(form({ ...valid, name: "  " }))).toEqual({ error: "Nhập tên nhóm" });
    expect(await saveModifierGroup(form({ ...valid, name: "THÊM topping", selection_mode: "MANY" }))).toEqual({ error: "Tên nhóm đã có" });
    expect(mocks.saveModifierGroupAtomic).not.toHaveBeenCalled();
  });

  it("keeps Thứ tự hiện between 1 and 99 and the cap between 1 and 20", async () => {
    expect(await saveModifierGroup(form({ ...valid, sort_order: "0" }))).toEqual({ error: "Thứ tự hiện từ 1 đến 99" });
    expect(await saveModifierGroup(form({ ...valid, sort_order: "100" }))).toEqual({ error: "Thứ tự hiện từ 1 đến 99" });
    expect(await saveModifierGroup(form({ ...valid, selection_mode: "MANY", max_total: "21" }))).toEqual({ error: "Tối đa từ 1 đến 20 phần" });
    expect(mocks.saveModifierGroupAtomic).not.toHaveBeenCalled();
  });

  it("creates a Chọn nhiều group with a new id, its cap and its ticked dishes", async () => {
    const res = await saveModifierGroup(
      form({ ...valid, name: "Thêm bánh", selection_mode: "MANY", max_total: "3", allow_standalone: "on" }, ["PROD-001", "PROD-002"]),
    );
    expect(res.success).toBe(true);
    expect(mocks.saveModifierGroupAtomic).toHaveBeenCalledWith({
      isEdit: false,
      group: { id: "MG-003", name: "Thêm bánh", selection_mode: "MANY", max_total: 3, allow_standalone: true, sort_order: 3 },
      productIds: ["PROD-001", "PROD-002"],
    });
    for (const sheet of ["Modifier_Groups", "Modifier_Group_Products", "Modifiers"]) {
      expect(mocks.revalidateTag).toHaveBeenCalledWith(`sheets-${sheet}`);
    }
  });

  it("sends no cap and no standalone flag for a Chọn một group", async () => {
    await saveModifierGroup(form({ ...valid, max_total: "5", allow_standalone: "on" }));
    expect(mocks.saveModifierGroupAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ group: expect.objectContaining({ selection_mode: "ONE", max_total: null, allow_standalone: false }) }),
    );
  });
});

describe("updateModifierGroup", () => {
  const edit = (fields: Record<string, string>) => form({ id: "MG-001", name: "Thêm Topping", selection_mode: "MANY", sort_order: "50", allow_standalone: "on", ...fields });

  it("keeps the group's own name without a duplicate error", async () => {
    expect((await updateModifierGroup(edit({}))).success).toBe(true);
    expect(mocks.saveModifierGroupAtomic).toHaveBeenCalledWith(expect.objectContaining({ isEdit: true }));
  });

  it("refuses to turn off Cho bán riêng while an option is sold on its own", async () => {
    const msg = "Nhóm có món bán riêng: Trân châu trắng. Tắt bán riêng ở từng món trước.";
    expect(await updateModifierGroup(form({ id: "MG-001", name: "Thêm Topping", selection_mode: "MANY", sort_order: "50" }))).toEqual({ error: msg });
    // switching to Chọn một turns it off too
    expect(await updateModifierGroup(edit({ selection_mode: "ONE" }))).toEqual({ error: msg });
    expect(mocks.saveModifierGroupAtomic).not.toHaveBeenCalled();
  });
});

describe("setModifierGroupStatus", () => {
  it("stops and restores a group", async () => {
    expect((await setModifierGroupStatus(form({ id: "MG-001", status: "INACTIVE" }))).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Modifier_Groups", "MG-001", { status: "INACTIVE" });
    expect(await setModifierGroupStatus(form({ id: "MG-001", status: "DELETED" }))).toEqual({ error: "Trạng thái không hợp lệ" });
  });
});

describe("deleteModifierGroup", () => {
  it("refuses a group that still has options, in Vietnamese, without trying to delete", async () => {
    expect(await deleteModifierGroup(form({ id: "MG-001" }))).toEqual({ error: "Nhóm còn tuỳ chọn: Trân châu trắng, Kem muối, Cũ." });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("erases an empty group, owner only", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) => (sheet === "Modifiers" ? [] : GROUPS));
    expect((await deleteModifierGroup(form({ id: "MG-001" }))).success).toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith("Modifier_Groups", "MG-001");
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ chủ quán" });
    expect(await deleteModifierGroup(form({ id: "MG-002" }))).toEqual({ error: "Chỉ chủ quán" });
  });

  it("translates the foreign-key refusal when an option appears between check and delete", async () => {
    mocks.findAll.mockImplementationOnce(async () => []);
    mocks.remove.mockRejectedValue(new Error('update or delete on table "modifier_groups" violates foreign key constraint'));
    expect(await deleteModifierGroup(form({ id: "MG-001" }))).toEqual({ error: "Nhóm còn tuỳ chọn: Trân châu trắng, Kem muối, Cũ." });
  });
});
