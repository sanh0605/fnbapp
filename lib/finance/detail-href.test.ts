import { describe, expect, it } from "vitest";
import { editBackHref } from "./detail-href";

const DIR = "/admin/finance/categories";

describe("editBackHref", () => {
  it("keeps a return link that is already this row's own detail page", () => {
    expect(editBackHref(`${DIR}/CFC-001?returnTo=%2Fadmin%2Ffinance%2Fcategories`, DIR, "CFC-001"))
      .toBe(`${DIR}/CFC-001?returnTo=%2Fadmin%2Ffinance%2Fcategories`);
    expect(editBackHref(`${DIR}/CFC-001`, DIR, "CFC-001")).toBe(`${DIR}/CFC-001`);
  });

  it("goes back to the detail page, remembering the list the user came from", () => {
    expect(editBackHref(`${DIR}?status=ACTIVE`, DIR, "CFC-001"))
      .toBe(`${DIR}/CFC-001?returnTo=${encodeURIComponent(`${DIR}?status=ACTIVE`)}`);
  });

  it("falls back to the list when the return link is some other detail page below the folder", () => {
    expect(editBackHref(`${DIR}/CFC-002`, DIR, "CFC-001"))
      .toBe(`${DIR}/CFC-001?returnTo=${encodeURIComponent(DIR)}`);
  });

  it("takes a separate list for rows whose detail pages sit in a sub-folder (transfers)", () => {
    expect(editBackHref("/admin/finance/transfers/CT-002", "/admin/finance/transfers", "CT-001", "/admin/finance"))
      .toBe(`/admin/finance/transfers/CT-001?returnTo=${encodeURIComponent("/admin/finance")}`);
  });

  it("does not mistake a longer id for the same row", () => {
    expect(editBackHref(`${DIR}/CFC-0011`, DIR, "CFC-001"))
      .toBe(`${DIR}/CFC-001?returnTo=${encodeURIComponent(DIR)}`);
  });
});
