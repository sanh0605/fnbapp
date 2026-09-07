import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isServiceRoleToken } from "@/supabase/functions/user-admin/service-role-token";

describe("user-admin Edge Function response contract", () => {
  it("projects the user list instead of serializing raw credential rows", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/functions/user-admin/index.ts"),
      "utf8",
    );

    expect(source).not.toContain(
      "const { data } = await admin.from('users').select('*').order('role').order('name')",
    );
    expect(source).toContain(
      "from('users').select('id, username, name, role, active, created_at')",
    );
  });

  it("rejects a forged service-role payload without the real service key", () => {
    const forgedPayload = Buffer.from(JSON.stringify({ role: "service_role" }))
      .toString("base64url");
    const forgedToken = `forged.${forgedPayload}.signature`;
    const serviceRoleKey = "real-service-role-key-value";

    expect(isServiceRoleToken(forgedToken, serviceRoleKey)).toBe(false);
    expect(isServiceRoleToken(serviceRoleKey, serviceRoleKey)).toBe(true);
  });
});
