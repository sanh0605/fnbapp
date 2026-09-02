import { describe, it, expect } from "vitest";
import { parseRelationBlock, serializeRelations } from "./relation-block";

describe("parseRelationBlock", () => {
  it("reads relations inside a ```relations fence and ignores prose", () => {
    const md = [
      "# System map",
      "Some prose about sales.",
      "```relations",
      "sales -> orders_v2 (write)",
      "sales -> order_payments (write)",
      "reports -> orders_v2 (read)",
      "```",
      "More prose.",
    ].join("\n");
    expect(parseRelationBlock(md)).toEqual([
      { from: "sales", to: "orders_v2", kind: "write" },
      { from: "sales", to: "order_payments", kind: "write" },
      { from: "reports", to: "orders_v2", kind: "read" },
    ]);
  });

  it("round-trips through serialize", () => {
    const rels = [
      { from: "b", to: "t2", kind: "write" as const },
      { from: "a", to: "t1", kind: "write" as const },
    ];
    const text = serializeRelations(rels);
    expect(parseRelationBlock(text)).toEqual([
      { from: "a", to: "t1", kind: "write" },
      { from: "b", to: "t2", kind: "write" },
    ]);
  });
});
