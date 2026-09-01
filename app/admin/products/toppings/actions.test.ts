import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", async () => {
  // docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
  // section 1.4: getCacheTag is the REAL, unmocked function here (via
  // importActual), so this file's own assertions can never silently drift
  // from what the source under test actually calls.
  const actual = await vi.importActual<typeof import("@/lib/sheets_db")>("@/lib/sheets_db");
  return {
    findAll: mocks.findAll,
    update: mocks.update,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { toggleToppingStandalone } from "./actions";
import { getCacheTag } from "@/lib/sheets_db";

// docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
// section 1.3 row 3 / section 3: Products is cached 10 min, keyed by table
// -- POS reads it through that cache, and revalidatePath("/pos") here has
// never actually helped (a path revalidation never touches the tag-keyed
// findAll cache -- docs/superpowers/plans/2026-08-31-pos-shows-stale-products.md's
// own finding, left as OPEN-ITEMS 79 there). Asserted against getCacheTag's
// real output (imported above, unmocked), not a re-typed string.
//
// Confirmed red against the pre-fix code (before revalidateTag was added)
// on "0 calls" -- a missing call, not a wrong value -- then restored.
describe("toggleToppingStandalone -- revalidates sheets-Products, not just the path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue([
      { id: "PROD-TOP-001", category_id: "CAT-007", status: "ACTIVE" },
    ]);
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

  it("refuses a product outside category CAT-007 and never revalidates anything", async () => {
    mocks.findAll.mockResolvedValue([{ id: "PROD-OTHER", category_id: "CAT-001", status: "ACTIVE" }]);

    const res = await toggleToppingStandalone("PROD-OTHER", true);

    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
