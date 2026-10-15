import { describe, expect, it } from "vitest";
import { activeOrOnOrder } from "./active-or-on-order";

const rows = [
  { id: "A", status: "ACTIVE" },
  { id: "B", status: "INACTIVE" },
  { id: "C", status: "INACTIVE" },
];

describe("activeOrOnOrder (BR-CATALOG-007)", () => {
  it("drops stopped rows when nothing is on the order", () => {
    expect(activeOrOnOrder(rows, []).map(r => r.id)).toEqual(["A"]);
  });
  it("keeps a stopped row that is already on the order", () => {
    expect(activeOrOnOrder(rows, ["B"]).map(r => r.id)).toEqual(["A", "B"]);
  });
});
