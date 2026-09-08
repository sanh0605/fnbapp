import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/admin/finance/bank-accounts/actions.ts"),
  "utf8",
);

describe("bank account actions", () => {
  it("guards every exported action behind an auth check", () => {
    const exported = source.match(/export async function \w+/g) ?? [];
    expect(exported.length).toBe(5);
    expect((source.match(/require(Admin|Owner)\(\)/g) ?? []).length).toBe(5);
  });

  it("lets only ADMIN delete an account permanently", () => {
    expect(source).toMatch(/deleteBankAccount[\s\S]{0,200}requireOwner\(\)/);
  });

  it("stamps who created and who edited, and never the timestamps", () => {
    expect(source).toContain("creationAudit(auth.actor)");
    expect(source).toContain("updateAudit(auth.actor)");
    expect(source).not.toContain("created_at:");
    expect(source).not.toContain("updated_at:");
  });

  it("rejects a blank name in Vietnamese", () => {
    expect(source).toContain('fail("Nhập tên tài khoản")');
  });

  it("stores a blank bank name or account number as null, not an empty string", () => {
    expect(source).toContain('|| null');
  });
});

// Ruling 4 -- migration 0101's partial unique index refuses two ACTIVE
// bank accounts sharing a name (migration 0065's normalising expression),
// but its violation message is plain ASCII English, and describeActionError
// replaces any all-ASCII exception with the generic Vietnamese fallback --
// so the owner retyping a name he already has would learn nothing. The app
// must catch this itself, in Vietnamese, before the DB round trip, using
// the same lib/shared/duplicate-name-guard.ts already used by
// app/admin/finance/categories, app/admin/inventory, app/admin/products
// and app/admin/suppliers.
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

import { addBankAccount, updateBankAccount } from "./actions";

const ADMIN = {
  ok: true as const,
  actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" as const },
};

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("duplicate name rejection (ruling 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to add an account whose name matches an ACTIVE one case-insensitively, in Vietnamese", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "BA-001", name: "Vietcombank Sanh", status: "ACTIVE" },
    ]);

    const result = await addBankAccount(formData({ name: "  vietcombank SANH  " }));

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/[^\x00-\x7F]/); // Vietnamese, not the generic ASCII DB error
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows a name that only collides with a retired (INACTIVE) account", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "BA-009", name: "Vietcombank Sanh", status: "INACTIVE" },
    ]);
    mocks.generateNewId.mockResolvedValue("BA-010");

    const result = await addBankAccount(formData({ name: "Vietcombank Sanh" }));

    expect(result.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalled();
  });

  it("lets a rename keep its own current name (excludes itself from the duplicate check)", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "BA-001", name: "Vietcombank Sanh", status: "ACTIVE" },
    ]);

    const result = await updateBankAccount(formData({ id: "BA-001", name: "Vietcombank Sanh" }));

    expect(result.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalled();
  });

  it("refuses a rename that collides with a different ACTIVE account", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "BA-001", name: "Vietcombank Sanh", status: "ACTIVE" },
      { id: "BA-002", name: "ACB Sanh", status: "ACTIVE" },
    ]);

    const result = await updateBankAccount(formData({ id: "BA-002", name: "vietcombank sanh" }));

    expect(result.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a name that differs from an ACTIVE one only by collapsible internal whitespace", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "BA-001", name: "Vietcombank Sanh", status: "ACTIVE" },
    ]);

    const result = await addBankAccount(formData({ name: "Vietcombank  Sanh" }));

    expect(result.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
