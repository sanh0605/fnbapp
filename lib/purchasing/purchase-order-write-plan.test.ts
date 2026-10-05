import { describe, expect, it } from "vitest";
import { buildPurchaseOrderWritePlan } from "@/lib/purchasing/purchase-order-write-plan";

const order = {
  id: "",
  supplier_id: "SUP-001",
  source_id: "SRC-001",
  transaction_date: "2026-07-01T03:00:00.000Z",
  supplier_invoice_code: "INV-001",
  notes: "",
  subtotal_amount: 196,
  shipping_fee: 0,
  tax_amount: 0,
  voucher_amount: 0,
  discount_amount: 0,
  total_amount: 196,
  status: "COMPLETED",
  created_by_id: "USR-001",
  created_by_name: "Admin",
};

const lines = [
  {
    purchased_item_id: "SPM-001",
    unit: "box",
    quantity: 2,
    subtotal: 196,
    conversion_id: "QD-001",
    base_unit: "U-ML",
  },
];

describe("buildPurchaseOrderWritePlan", () => {
  it("builds collision-safe child rows and preserves conversion data", () => {
    const ids = ["line-uuid"];
    const plan = buildPurchaseOrderWritePlan({
      order,
      lines,
      purchasedItems: [
        { id: "SPM-001" },
      ],
      conversions: [
        {
          id: "QD-001",
          purchased_item_id: "SPM-001",
          purchased_unit: "box",
          conversion_rate: 5,
        },
      ],
      createdAt: "2026-07-01T04:00:00.000Z",
      idFactory: () => ids.shift()!,
    });

    expect(plan.lines).toEqual([
      expect.objectContaining({
        id: "POL-line-uuid",
        purchased_item_id: "SPM-001",
        conversion_id: "QD-001",
        base_unit: "U-ML",
        base_quantity: 10,
        unit_price: 98,
        subtotal: 196,
        created_at: "2026-07-01T04:00:00.000Z",
      }),
    ]);
  });

  it("does not create receipt ledger rows for a draft order", () => {
    const plan = buildPurchaseOrderWritePlan({
      order: { ...order, status: "DRAFT" },
      lines,
      purchasedItems: [
        { id: "SPM-001" },
      ],
      conversions: [
        {
          id: "QD-001",
          purchased_item_id: "SPM-001",
          purchased_unit: "box",
          conversion_rate: 5,
        },
      ],
      createdAt: "2026-07-01T04:00:00.000Z",
      idFactory: () => "uuid",
    });

    expect(plan.lines).toEqual([
      expect.objectContaining({
        conversion_id: "QD-001",
        base_quantity: 10,
      }),
    ]);
  });

  it("allows an incomplete draft line without creating stock", () => {
    const plan = buildPurchaseOrderWritePlan({
      order: { ...order, status: "DRAFT" },
      lines: [
        {
          purchased_item_id: "",
          unit: "",
          quantity: 1,
          subtotal: 0,
          conversion_id: "",
          base_unit: "",
        },
      ],
      purchasedItems: [],
      conversions: [],
      createdAt: "2026-07-01T04:00:00.000Z",
      idFactory: () => "draft-uuid",
    });

    expect(plan.lines).toEqual([
      expect.objectContaining({
        id: "POL-draft-uuid",
        purchased_item_id: "",
        conversion_id: "",
        base_quantity: 0,
      }),
    ]);
  });

  it("fails before returning a partial plan when an item is missing", () => {
    expect(() =>
      buildPurchaseOrderWritePlan({
        order,
        lines,
        purchasedItems: [],
        conversions: [],
        createdAt: "2026-07-01T04:00:00.000Z",
        idFactory: () => "uuid",
      }),
    ).toThrow("SPM-001");
  });

  it("refuses a draft line that has money but an unresolvable conversion", () => {
    expect(() =>
      buildPurchaseOrderWritePlan({
        order: { ...order, status: "DRAFT" },
        lines: [
          {
            purchased_item_id: "SPM-001",
            unit: "box",
            quantity: 2,
            subtotal: 196,
            conversion_id: "QD-DOES-NOT-EXIST",
            base_unit: "U-ML",
          },
        ],
        purchasedItems: [
          { id: "SPM-001" },
        ],
        conversions: [
          {
            id: "QD-001",
            purchased_item_id: "SPM-001",
            purchased_unit: "box",
            conversion_rate: 5,
          },
        ],
        createdAt: "2026-07-01T04:00:00.000Z",
        idFactory: () => "uuid",
      }),
    ).toThrow("SPM-001");
  });

  it("refuses a draft line that has money but no conversion selected at all", () => {
    expect(() =>
      buildPurchaseOrderWritePlan({
        order: { ...order, status: "DRAFT" },
        lines: [
          {
            purchased_item_id: "SPM-001",
            unit: "box",
            quantity: 2,
            subtotal: 196,
            conversion_id: "",
            base_unit: "U-ML",
          },
        ],
        purchasedItems: [
          { id: "SPM-001" },
        ],
        conversions: [],
        createdAt: "2026-07-01T04:00:00.000Z",
        idFactory: () => "uuid",
      }),
    ).toThrow("SPM-001");
  });
  describe("line ids on an edit", () => {
    const eggLine = { purchased_item_id: "SPM-EGG", unit: "box", quantity: 2, subtotal: 196, conversion_id: "QD-EGG", base_unit: "U-PCS" };
    const milkLine = { purchased_item_id: "SPM-MILK", unit: "box", quantity: 2, subtotal: 196, conversion_id: "QD-MILK", base_unit: "U-ML" };
    const edit = {
      order,
      purchasedItems: [{ id: "SPM-EGG" }, { id: "SPM-MILK" }],
      conversions: [
        { id: "QD-EGG", purchased_item_id: "SPM-EGG", purchased_unit: "box", conversion_rate: 5 },
        { id: "QD-MILK", purchased_item_id: "SPM-MILK", purchased_unit: "box", conversion_rate: 5 },
      ],
      createdAt: "2026-07-01T04:00:00.000Z",
    };

    it("reuses the saved line id of the same item on an edit", () => {
      const plan = buildPurchaseOrderWritePlan({
        ...edit,
        lines: [{ ...eggLine }, { ...milkLine }],
        existingLines: [
          { id: "POL-old-milk", purchased_item_id: "SPM-MILK" },
          { id: "POL-old-egg", purchased_item_id: "SPM-EGG" },
        ],
        idFactory: () => "new",
      });
      expect(plan.lines.map(l => l.id)).toEqual(["POL-old-egg", "POL-old-milk"]);
    });

    it("matches two lines of one item in order and mints an id for a third", () => {
      const plan = buildPurchaseOrderWritePlan({
        ...edit,
        lines: [{ ...eggLine }, { ...eggLine }, { ...eggLine }],
        existingLines: [
          { id: "POL-a", purchased_item_id: "SPM-EGG" },
          { id: "POL-b", purchased_item_id: "SPM-EGG" },
        ],
        idFactory: () => "new",
      });
      expect(plan.lines.map(l => l.id)).toEqual(["POL-a", "POL-b", "POL-new"]);
    });

    it("mints every id for a new order", () => {
      const plan = buildPurchaseOrderWritePlan({ ...edit, lines: [{ ...eggLine }], idFactory: () => "new" });
      expect(plan.lines[0].id).toBe("POL-new");
    });
  });
});
