import { describe, it, expect } from "vitest";
import { extractWrites } from "./extract-writes";

describe("extractWrites", () => {
  it("resolves literal, same-file const, shared-actions two-hop, and direct supabase.from", () => {
    const files = [
      { path: "app/a/actions.ts", source: `await insert("Units", data);` },
      { path: "app/b/actions.ts", source: `const SHEET = "Users";\nawait update(SHEET, id, data);` },
      { path: "app/c/actions.ts", source: `const SHEET = "Brands";\nreturn createEntity(SHEET, "BR", data, PATH);` },
      { path: "app/actions/auth.ts", source: `await supabase.from("users").update({ password_hash });` },
    ];
    const { writes } = extractWrites(files);
    expect(writes).toEqual([
      { file: "app/a/actions.ts", table: "Units" },
      { file: "app/actions/auth.ts", table: "users" },
      { file: "app/b/actions.ts", table: "Users" },
      { file: "app/c/actions.ts", table: "Brands" },
    ]);
  });

  it("reports an unresolvable table name instead of dropping it", () => {
    const files = [{ path: "app/d/actions.ts", source: `await insert(computeName(x), data);` }];
    const { writes, unresolved } = extractWrites(files);
    expect(writes).toEqual([]);
    expect(unresolved).toEqual([
      { file: "app/d/actions.ts", reason: "insert(...) with a non-literal table argument: computeName(x)" },
    ]);
  });
});
