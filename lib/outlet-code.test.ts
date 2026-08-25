import { describe, expect, it } from "vitest";
import { nextOutletCode } from "./outlet-code";

describe("nextOutletCode", () => {
  it("assigns 001 for the first outlet", () => {
    expect(nextOutletCode([])).toBe("001");
  });

  it("assigns max + 1", () => {
    expect(nextOutletCode(["001", "002"])).toBe("003");
  });

  it("takes the max, not a gap left by a retired code -- the code is never reused", () => {
    // Owner's own example (2026-08-24 plan section 5.1): "Diem ban 4: 004
    // (khong thay the vao lai diem ban da ngung hoat dong)". Outlet 002 is
    // retired but its row -- and its code -- still exists in the list this
    // function is given, so the gap at 002 is never offered again.
    expect(nextOutletCode(["001", "002", "003"])).toBe("004");
  });

  it("is unaffected by input order", () => {
    expect(nextOutletCode(["003", "001", "002"])).toBe("004");
  });
});
