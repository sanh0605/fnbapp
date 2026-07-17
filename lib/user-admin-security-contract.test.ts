import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
});
