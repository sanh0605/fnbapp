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
// categories sharing a name (lower(trim(name))), but its violation message
// is plain ASCII English, and describeActionError replaces any all-ASCII
// exception with the generic Vietnamese fallback -- so the owner retyping
// a name he already has would learn nothing. The app must catch this
// itself, in Vietnamese, before the DB round trip.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
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
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addCashCategory, updateCashCategory } from "./actions";

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
      { id: "CFC-001", name: "Vận hành", status: "ACTIVE" },
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
});
