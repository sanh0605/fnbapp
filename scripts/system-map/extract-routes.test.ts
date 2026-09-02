import { describe, it, expect } from "vitest";
import { extractRoutes } from "./extract-routes";

describe("extractRoutes", () => {
  it("dedupes imports and sorts both actions and routes", () => {
    const pages = [
      { route: "/b", imports: ["z", "a", "a"] },
      { route: "/a", imports: ["c"] },
    ];
    expect(extractRoutes(pages)).toEqual([
      { route: "/a", actions: ["c"] },
      { route: "/b", actions: ["a", "z"] },
    ]);
  });
});
