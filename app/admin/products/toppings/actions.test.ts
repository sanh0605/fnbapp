import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", async () => {
  // section 1.4: getCacheTag is the REAL, unmocked function here (via
  // importActual), so this file's own assertions can never silently drift
  // from what the source under test actually calls.
  const actual = await vi.importActual<typeof import("@/lib/db/tables")>("@/lib/db/tables");
  return {
    findAll: mocks.findAll,
    update: mocks.update,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { toggleToppingStandalone } from "./actions";
import { getCacheTag } from "@/lib/db/tables";

// section 1.3 row 3 / section 3: Products is cached 10 min, keyed by table
// -- POS reads it through that cache, and revalidatePath("/pos") here has
// never actually helped (a path revalidation never touches the tag-keyed
// findAll cache -- that plan's
// own finding, left as OPEN-ITEMS 79 there). Asserted against getCacheTag's
// real output (imported above, unmocked), not a re-typed string.
//
// Confirmed red against the pre-fix code (before revalidateTag was added)
// on "0 calls" -- a missing call, not a wrong value -- then restored.
describe("toggleToppingStandalone -- revalidates sheets-Products, not just the path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Modifiers"
        ? [{ id: "MOD-TOP-001", product_id: "PROD-TOP-001", status: "ACTIVE" }]
        : [{ id: "PROD-TOP-001", category_id: "CAT-007", status: "ACTIVE" }]
    );
  });

  it("enabling a standalone topping revalidates sheets-Products", async () => {
    const res = await toggleToppingStandalone("PROD-TOP-001", true);

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Products", "PROD-TOP-001", { status: "ACTIVE" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Products"));
  });

  it("disabling a standalone topping revalidates sheets-Products", async () => {
    const res = await toggleToppingStandalone("PROD-TOP-001", false);

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Products", "PROD-TOP-001", { status: "INACTIVE" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Products"));
  });

  it("refuses a product no topping links to, in Vietnamese, and never revalidates anything", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Modifiers"
        ? [{ id: "MOD-TOP-001", product_id: "PROD-TOP-001", status: "ACTIVE" }]
        : [{ id: "PROD-OTHER", category_id: "CAT-007", status: "ACTIVE" }]
    );

    const res = await toggleToppingStandalone("PROD-OTHER", true);

    expect(res.error).toBeTruthy();
    expect(res.error).not.toMatch(/category/i);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

// Audit F4, owner 2026-10-14 "Mặc định Topping, sửa được": a standalone
// topping may be moved to another dish group from Sửa món; the switch follows
// the modifier link (modifiers.product_id), not the group.
describe("toggleToppingStandalone -- follows the topping link, not the dish group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Modifiers"
        ? [{ id: "MOD-009", product_id: "PROD-049", status: "ACTIVE" }]
        : [{ id: "PROD-049", name: "Hộp sữa chua", category_id: "CAT-006", status: "ACTIVE" }]
    );
  });

  it("toggles Hộp sữa chua after it was moved to Thức ăn", async () => {
    const res = await toggleToppingStandalone("PROD-049", false);

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Products", "PROD-049", { status: "INACTIVE" });
  });
});
