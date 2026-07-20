import { describe, expect, it } from "vitest";
import { buildFilterSearchParams, readFilterValuesFromParams } from "./use-filter-form";

describe("buildFilterSearchParams", () => {
  const defaults = { status: "PENDING", q: "" };

  it("sets a param whose draft value differs from the default", () => {
    const params = buildFilterSearchParams(new URLSearchParams(), { status: "APPROVED", q: "" }, defaults);
    expect(params.toString()).toBe("status=APPROVED");
  });

  it("omits a param whose draft value equals the default", () => {
    const params = buildFilterSearchParams(new URLSearchParams("status=APPROVED"), { status: "PENDING", q: "" }, defaults);
    expect(params.get("status")).toBeNull();
  });

  it("omits an empty-string draft value even when the default is non-empty", () => {
    const params = buildFilterSearchParams(new URLSearchParams(), { status: "", q: "" }, defaults);
    expect(params.get("status")).toBeNull();
  });

  it("preserves unrelated existing params not managed by this filter form", () => {
    const params = buildFilterSearchParams(new URLSearchParams("page=3"), { status: "APPROVED", q: "" }, defaults);
    expect(params.get("page")).toBe("3");
    expect(params.get("status")).toBe("APPROVED");
  });

  it("sets multiple changed params together", () => {
    const params = buildFilterSearchParams(new URLSearchParams(), { status: "APPROVED", q: "NNL-007" }, defaults);
    expect(params.get("status")).toBe("APPROVED");
    expect(params.get("q")).toBe("NNL-007");
  });
});

describe("readFilterValuesFromParams", () => {
  const defaults = { status: "PENDING", q: "" };

  it("reads a value present in the URL", () => {
    const result = readFilterValuesFromParams(new URLSearchParams("status=REJECTED"), defaults);
    expect(result).toEqual({ status: "REJECTED", q: "" });
  });

  it("falls back to the default when a key is absent from the URL", () => {
    const result = readFilterValuesFromParams(new URLSearchParams(""), defaults);
    expect(result).toEqual(defaults);
  });

  it("ignores unrelated params not in defaults", () => {
    const result = readFilterValuesFromParams(new URLSearchParams("page=2&status=RECOMPUTED"), defaults);
    expect(result).toEqual({ status: "RECOMPUTED", q: "" });
  });
});
