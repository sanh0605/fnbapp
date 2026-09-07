import { describe, expect, it } from "vitest";
import { formatDateTime, formatDate, formatTime, toSaigonIsoString } from "./datetime";

describe("formatDateTime", () => {
  it("formats UTC instant as Asia/Saigon local time", () => {
    // 2026-06-25T07:31:08.402Z UTC = 2026-06-25 14:31:08 Asia/Saigon
    expect(formatDateTime("2026-06-25T07:31:08.402Z")).toBe("25/06/2026 14:31");
  });

  it("withSeconds=true appends seconds", () => {
    expect(formatDateTime("2026-06-25T07:31:08.402Z", { withSeconds: true })).toBe("25/06/2026 14:31:08");
  });

  it("withDate=false returns time only", () => {
    expect(formatDateTime("2026-06-25T07:31:08.402Z", { withDate: false })).toBe("14:31");
  });

  it("returns empty for null/invalid", () => {
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not-a-date")).toBe("");
  });

  it("crosses day boundary correctly (UTC 17:00 → Saigon 00:00 next day)", () => {
    expect(formatDateTime("2026-06-25T17:00:00.000Z")).toBe("26/06/2026 00:00");
  });
});

describe("formatDate", () => {
  it("formats date only", () => {
    expect(formatDate("2026-06-25T07:31:08.402Z")).toBe("25/06/2026");
  });
});

describe("formatTime", () => {
  it("formats time only", () => {
    expect(formatTime("2026-06-25T07:31:08.402Z")).toBe("14:31");
    expect(formatTime("2026-06-25T07:31:08.402Z", true)).toBe("14:31:08");
  });
});

describe("toSaigonIsoString", () => {
  it("converts UTC Date to Saigon-local ISO string", () => {
    const d = new Date("2026-06-25T07:31:08.402Z");
    expect(toSaigonIsoString(d)).toBe("2026-06-25T14:31:08");
  });

  it("day boundary crosses", () => {
    const d = new Date("2026-06-25T17:00:00.000Z");
    expect(toSaigonIsoString(d)).toBe("2026-06-26T00:00:00");
  });
});
