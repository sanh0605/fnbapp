import { describe, expect, it } from "vitest";
import { findUnguardedAdminMutations } from "@/lib/admin-auth-guard-audit";

describe("findUnguardedAdminMutations", () => {
  it("reports exported admin mutations without a server-side auth guard", () => {
    const source = `
      export async function getRows() {
        return [];
      }

      export async function saveRow() {
        await insert("Rows", {});
      }

      export async function deleteRow() {
        const auth = await requireAdmin();
        if (!auth.ok) return fail(auth.error);
        await remove("Rows", "ROW-1");
      }
    `;

    expect(findUnguardedAdminMutations(source)).toEqual(["saveRow"]);
  });

  it("accepts resolveActor for authenticated non-admin workflows", () => {
    const source = `
      export async function submitStockAdjustment() {
        const auth = await resolveActor();
        if (!auth.ok) return fail(auth.error);
      }
    `;

    expect(findUnguardedAdminMutations(source)).toEqual([]);
  });
});
