import { describe, expect, it } from "vitest";
import * as auditModule from "@/lib/admin-auth-guard-audit";

const { findUnguardedAdminMutations } = auditModule;

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
        await insert("Stock_Adjustments", {});
      }
    `;

    expect(findUnguardedAdminMutations(source)).toEqual([]);
  });

  it("reports an unguarded mutation exported as an arrow function", () => {
    const source = `
      export const recordRow = async () => {
        await insert("Rows", {});
      };

      export const applyRow = async () => {
        const auth = await requireAdmin();
        if (!auth.ok) return fail(auth.error);
        await supabase.rpc("apply_row", {});
      };
    `;

    expect(findUnguardedAdminMutations(source)).toEqual(["recordRow"]);
  });

  it("reports a guard call whose result never gates the mutation", () => {
    const source = `
      export async function saveRow() {
        const auth = await requireAdmin();
        console.info(auth);
        await update("Rows", "ROW-1", {});
      }
    `;

    expect(findUnguardedAdminMutations(source)).toEqual(["saveRow"]);
  });

  it("classifies exports by write evidence instead of their names", () => {
    const source = `
      export async function getRows() {
        return findAll("Rows");
      }

      export async function recordSnapshot() {
        await insertMany("Rows", []);
      }
    `;

    const auditActionExports = (auditModule as Record<string, unknown>).auditActionExports;
    expect(auditActionExports).toBeTypeOf("function");
    expect((auditActionExports as (value: string) => unknown)(source)).toEqual([
      expect.objectContaining({ name: "getRows", isMutation: false }),
      expect.objectContaining({ name: "recordSnapshot", isMutation: true }),
    ]);
  });

  it("audits guarded, unguarded, and aliased API route handlers", () => {
    const source = `
      export async function GET() {
        const auth = await requireAdmin();
        if (!auth.ok) return NextResponse.json({}, { status: 401 });
        return NextResponse.json({ ok: true });
      }

      export const POST = async () => NextResponse.json({ ok: true });
      const authHandler = NextAuth(authOptions);
      export { authHandler as DELETE };
    `;

    const auditRouteHandlers = (auditModule as Record<string, unknown>).auditRouteHandlers;
    expect(auditRouteHandlers).toBeTypeOf("function");
    expect((auditRouteHandlers as (value: string) => unknown)(source)).toEqual([
      expect.objectContaining({ method: "GET", guardKind: "ADMIN", guardEnforced: true }),
      expect.objectContaining({ method: "POST", guardKind: "NONE", guardEnforced: false }),
      expect.objectContaining({ method: "DELETE", exportStyle: "alias", guardEnforced: false }),
    ]);
  });

  it("discovers conventional and explicitly declared server-action files", () => {
    const isServerActionSourceFile = (
      auditModule as Record<string, unknown>
    ).isServerActionSourceFile;
    expect(isServerActionSourceFile).toBeTypeOf("function");
    const classify = isServerActionSourceFile as (path: string, source: string) => boolean;

    expect(classify("app/admin/users/actions.ts", `"use server";`)).toBe(true);
    expect(classify("app/pos/actions.ts", `"use server";`)).toBe(true);
    expect(classify("app/actions/auth.ts", `'use server';`)).toBe(true);
    expect(classify("app/api/revalidate/route.ts", `export async function GET() {}`)).toBe(false);
  });

  it("includes an exported action wrapped by a cache helper", () => {
    const source = `
      export const getRealtimeStock = unstable_cache(
        async () => {
          return findAll("Stock_Ledger");
        },
        ["realtime-stock"],
      );
    `;

    const auditActionExports = (auditModule as Record<string, unknown>).auditActionExports;
    expect((auditActionExports as (value: string) => unknown)(source)).toEqual([
      expect.objectContaining({
        name: "getRealtimeStock",
        exportStyle: "wrapped-arrow",
        isMutation: false,
      }),
    ]);
  });

  it("recognizes an enforced ADMIN role check after resolveActor", () => {
    const source = `
      export async function toggleRow() {
        const auth = await resolveActor();
        if (!auth.ok || auth.actor.role !== "ADMIN") return fail("ADMIN only");
        await update("Rows", "ROW-1", {});
      }
    `;

    const auditActionExports = (auditModule as Record<string, unknown>).auditActionExports;
    expect((auditActionExports as (value: string) => any[])(source)[0]).toMatchObject({
      guardKind: "ADMIN",
      guardEnforced: true,
    });
  });

  it("recognizes reviewed shared action write wrappers", () => {
    const source = `
      export async function maintainRows() {
        const auth = await requireAdmin();
        if (!auth.ok) return fail(auth.error);
        await createEntity("Rows", "ROW", {});
        await updateEntity("Rows", "ROW-1", {});
        await deleteEntity("Rows", "ROW-2");
        await softDeleteEntity("Rows", "ROW-3");
      }
    `;

    const auditActionExports = (auditModule as Record<string, unknown>).auditActionExports;
    expect((auditActionExports as (value: string) => any[])(source)[0]).toMatchObject({
      isMutation: true,
      mutationSignals: ["createEntity", "deleteEntity", "softDeleteEntity", "updateEntity"],
    });
  });
});
