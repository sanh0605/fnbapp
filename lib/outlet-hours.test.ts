import { describe, expect, it } from "vitest";
import { isOutletOpenAt } from "./outlet-hours";

describe("isOutletOpenAt", () => {
  // The plan's own example (section 5): "an outlet open 06:00-11:00 reads
  // as open at 07:00 Saigon and closed at 15:00".
  it("reads as open during the window", () => {
    expect(isOutletOpenAt("06:00", "11:00", "07:00")).toBe(true);
  });

  it("reads as closed outside the window", () => {
    expect(isOutletOpenAt("06:00", "11:00", "15:00")).toBe(false);
  });

  it("is open at the exact open minute (inclusive)", () => {
    expect(isOutletOpenAt("06:00", "11:00", "06:00")).toBe(true);
  });

  it("is closed at the exact close minute (exclusive)", () => {
    expect(isOutletOpenAt("06:00", "11:00", "11:00")).toBe(false);
  });

  it("never marks closed when both hours are null -- no stated hours, no check", () => {
    expect(isOutletOpenAt(null, null, "03:00")).toBe(true);
  });

  it("never marks closed when only one bound is set", () => {
    expect(isOutletOpenAt("06:00", null, "03:00")).toBe(true);
    expect(isOutletOpenAt(null, "11:00", "03:00")).toBe(true);
  });

  it("handles an overnight window that crosses midnight", () => {
    expect(isOutletOpenAt("17:00", "02:00", "23:00")).toBe(true); // late evening
    expect(isOutletOpenAt("17:00", "02:00", "01:00")).toBe(true); // after midnight, still open
    expect(isOutletOpenAt("17:00", "02:00", "10:00")).toBe(false); // mid-morning, closed
  });

  it("accepts Postgres time's own HH:MM:SS serialization", () => {
    expect(isOutletOpenAt("06:00:00", "11:00:00", "07:00")).toBe(true);
    expect(isOutletOpenAt("06:00:00", "11:00:00", "15:00")).toBe(false);
  });

  it("treats equal open and close as unset rather than permanently closed", () => {
    expect(isOutletOpenAt("09:00", "09:00", "10:00")).toBe(true);
  });
});
