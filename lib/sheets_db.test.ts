import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  valuesGet: vi.fn(),
  valuesBatchUpdate: vi.fn(),
}));

vi.hoisted(() => {
  process.env.GOOGLE_SPREADSHEET_ID = "sheet-id";
  process.env.GOOGLE_CREDENTIALS_BASE64 = Buffer.from("{}").toString("base64");
});

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (fn: any) => fn,
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn(),
    },
    sheets: vi.fn(() => ({
      spreadsheets: {
        values: {
          get: mocks.valuesGet,
          batchUpdate: mocks.valuesBatchUpdate,
        },
      },
    })),
  },
}));

import { updateMany } from "./sheets_db";

describe("updateMany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates multiple existing rows in one batch request", async () => {
    mocks.valuesGet.mockResolvedValue({
      data: {
        values: [
          ["id", "name", "unit", "status"],
          ["POL-001", "Old one", "kg", "ACTIVE"],
          ["POL-002", "Old two", "g", "ACTIVE"],
          ["POL-003", "Keep", "ml", "ACTIVE"],
        ],
      },
    });
    mocks.valuesBatchUpdate.mockResolvedValue({});

    const result = await updateMany("Purchase_Order_Lines", [
      { id: "POL-001", unit: "gram" },
      { id: "POL-002", name: "New two", unit: "gram" },
    ]);

    expect(result).toEqual([
      { id: "POL-001", name: "Old one", unit: "gram", status: "ACTIVE" },
      { id: "POL-002", name: "New two", unit: "gram", status: "ACTIVE" },
    ]);
    expect(mocks.valuesBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.valuesBatchUpdate).toHaveBeenCalledWith({
      spreadsheetId: "sheet-id",
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: "Purchase_Order_Lines!A2:Z2",
            values: [["POL-001", "Old one", "gram", "ACTIVE"]],
          },
          {
            range: "Purchase_Order_Lines!A3:Z3",
            values: [["POL-002", "New two", "gram", "ACTIVE"]],
          },
        ],
      },
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Purchase_Order_Lines");
  });
});
