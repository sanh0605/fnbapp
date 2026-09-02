import { describe, it, expect } from "vitest";
import { checkMapDrift } from "./map-drift-core";

const gen = "```relations\napp/pos/actions.ts -> orders_v2 (write)\napp/pos/actions.ts -> order_payments (write)\n```";

describe("checkMapDrift", () => {
  it("passes when the hand block lists every generated write relation", () => {
    const r = checkMapDrift(gen, gen);
    expect(r.ok).toBe(true);
  });

  it("fails naming the relation the hand map is missing", () => {
    const hand = "```relations\napp/pos/actions.ts -> orders_v2 (write)\n```";
    const r = checkMapDrift(gen, hand);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([
      "hand SYSTEM-MAP.md is missing write relation: app/pos/actions.ts -> order_payments",
    ]);
  });
});
