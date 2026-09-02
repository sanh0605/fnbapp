import { describe, it, expect } from "vitest";
import { buildMap } from "./build-map";
import { parseRelationBlock } from "../doc-map/relation-block";

describe("buildMap", () => {
  it("emits a relations block covering every write-site", () => {
    const md = buildMap({
      tables: [{ name: "orders_v2", columns: ["id", "status"], statusValues: ["COMPLETED", "SUPERSEDED"] }],
      writes: [{ file: "app/pos/actions.ts", table: "orders_v2" }],
      unresolved: [],
      routes: [],
    });
    expect(parseRelationBlock(md)).toEqual([
      { from: "app/pos/actions.ts", to: "orders_v2", kind: "write" },
    ]);
  });

  it("lists unresolved writes in a visible section so they are not lost", () => {
    const md = buildMap({ tables: [], writes: [], unresolved: [{ file: "app/x.ts", reason: "dynamic" }], routes: [] });
    expect(md).toContain("UNRESOLVED");
    expect(md).toContain("app/x.ts");
  });
});
