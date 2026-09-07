import { describe, expect, it } from "vitest";
import { resolveCapturedAt } from "./pos-captured-at";

describe("resolveCapturedAt", () => {
  const serverNow = new Date("2026-06-15T00:00:00.000Z");

  it("uses the client timestamp when it is in the past within 30 days", () => {
    const result = resolveCapturedAt("2026-06-01T00:00:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: "2026-06-01T00:00:00.000Z", rejected: false });
  });

  it("uses the client timestamp when it is up to 5 minutes in the future", () => {
    const result = resolveCapturedAt("2026-06-15T00:05:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: "2026-06-15T00:05:00.000Z", rejected: false });
  });

  it("falls back to server time when the client timestamp is more than 30 days in the past", () => {
    const result = resolveCapturedAt("2026-05-01T00:00:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: true });
  });

  it("falls back to server time when the client timestamp is more than 5 minutes in the future", () => {
    const result = resolveCapturedAt("2026-06-15T00:06:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: true });
  });

  it("falls back to server time when the client timestamp is not a valid date", () => {
    const result = resolveCapturedAt("not-a-date", serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: true });
  });

  it("uses server time when no client timestamp is provided (backward compatible)", () => {
    const result = resolveCapturedAt(undefined, serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: false });
  });
});
