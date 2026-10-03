import { describe, expect, it } from "vitest";
import { formatDateTime, formatDate, formatTime, toSaigonIsoString, formatDateTimeFull, parseVnDay, formatVnDay, saigonToday, formatVnDayWithWeekday } from "./datetime";

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

describe("formatDateTimeFull (BR-DATA-006)", () => {
  it("shows a stored instant in Saigon time to the second", () => {
    expect(formatDateTimeFull("2026-09-28T09:13:06.000Z")).toBe("28/09/2026 16:13:06");
  });
  it("shows a Saigon-midnight slip on its own day, not the day before (PO-188)", () => {
    expect(formatDateTimeFull("2026-09-22T17:00:00+00:00")).toBe("23/09/2026 00:00:00");
  });
  it("reads a day-only value as Saigon midnight, never 07:00:00", () => {
    expect(formatDateTimeFull("2026-09-28")).toBe("28/09/2026 00:00:00");
  });
  it("returns empty for empty or unreadable input", () => {
    expect(formatDateTimeFull("")).toBe("");
    expect(formatDateTimeFull(null)).toBe("");
    expect(formatDateTimeFull("không phải ngày")).toBe("");
  });
});

describe("parseVnDay / formatVnDay", () => {
  it("parses dd/mm/yyyy, with or without leading zeros", () => {
    expect(parseVnDay("23/09/2026")).toBe("2026-09-23");
    expect(parseVnDay(" 1/9/2026 ")).toBe("2026-09-01");
  });
  it("rejects impossible dates and other shapes", () => {
    expect(parseVnDay("31/02/2026")).toBeNull();
    expect(parseVnDay("2026-09-23")).toBeNull();
    expect(parseVnDay("abc")).toBeNull();
    expect(parseVnDay("")).toBeNull();
  });
  it("formats an ISO day for display", () => {
    expect(formatVnDay("2026-09-01")).toBe("01/09/2026");
    expect(formatVnDay("bad")).toBe("");
  });
});

describe("saigonToday", () => {
  it("06:30 Saigon belongs to the Saigon day, not the UTC day before", () => {
    expect(saigonToday(new Date("2026-09-14T23:30:00Z"))).toBe("2026-09-15");
  });
  it("23:59:59 Saigon is still the same day", () => {
    expect(saigonToday(new Date("2026-09-15T16:59:59Z"))).toBe("2026-09-15");
  });
  it("00:00:00 Saigon starts the next day", () => {
    expect(saigonToday(new Date("2026-09-15T17:00:00Z"))).toBe("2026-09-16");
  });
});

describe("formatVnDayWithWeekday", () => {
  it("keeps the long weekday wording for a day-only value", () => {
    expect(formatVnDayWithWeekday("2026-09-15")).toBe("Thứ Ba, 15/09/2026");
    expect(formatVnDayWithWeekday("2026-09-20")).toBe("Chủ Nhật, 20/09/2026");
  });
  it("returns empty for a non day value", () => {
    expect(formatVnDayWithWeekday("")).toBe("");
  });
});
