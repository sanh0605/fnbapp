// section A3/A7: the RESTRICT foreign keys blocking a unit delete are
// correct and stay -- CLAUDE.md section 2 depends on this exact layer for
// products, and this is the same protection for units. The defect was that
// nothing ever named which one fired, or what real row it was protecting.
// This is pure (no DB access) -- the caller (app/admin/inventory/actions.ts)
// runs the actual lookups and passes in only what was found, following the
// same split as lib/duplicate-name-guard.ts and lib/unit-lock.ts.
//
// Measured live 2026-09-01: exactly 7 foreign keys reference units.id, all
// ON DELETE RESTRICT -- uom_conversions (two columns), purchased_items,
// base_ingredients, semi_products, purchase_order_lines, production_items.

export type UnitBlockerKind =
  | "uom_conversions"
  | "purchased_items"
  | "base_ingredients"
  | "semi_products"
  | "purchase_order_lines"
  | "production_items";

export type UnitBlockerFinding = {
  kind: UnitBlockerKind;
  /** How many referencing rows exist -- not necessarily every one, just enough to explain the block. */
  count: number;
  /** Real name of the entity the referencing row belongs to (never a code like QD-015 or SPM-027). */
  ownerName: string;
};

function clauseFor(finding: UnitBlockerFinding): string {
  const { kind, count, ownerName } = finding;
  switch (kind) {
    case "uom_conversions":
      return `${count} dòng quy đổi của ${ownerName}`;
    case "purchased_items":
      return `mặt hàng mua ${ownerName}`;
    case "base_ingredients":
      return `nhóm nguyên liệu ${ownerName}`;
    case "semi_products":
      return `bán thành phẩm ${ownerName}`;
    case "purchase_order_lines":
      return `${count} dòng đơn nhập lịch sử của ${ownerName}`;
    case "production_items":
      return `${count} dòng kế hoạch sản xuất`;
  }
}

function hintFor(finding: UnitBlockerFinding): string {
  switch (finding.kind) {
    case "uom_conversions":
      return finding.count === 1 ? "Xoá dòng quy đổi đó trước." : "Xoá các dòng quy đổi đó trước.";
    case "purchased_items":
      return "Đổi đơn vị mặc định của mặt hàng đó trước.";
    case "base_ingredients":
      return "Đổi đơn vị gốc của nhóm nguyên liệu đó trước.";
    case "semi_products":
      return "Đổi đơn vị gốc của bán thành phẩm đó trước.";
    case "purchase_order_lines":
      // Unlike the other sources, this one is never freeable -- a purchase
      // order line's unit is frozen history (same reasoning as
      // lib/unit-lock.ts), not something the owner can go edit away.
      return "Đây là lịch sử đơn nhập đã ghi nhận, đơn vị này không thể xoá được nữa.";
    case "production_items":
      return "Xoá dòng kế hoạch sản xuất đó trước.";
  }
}

/**
 * Builds the exact sentence the owner sees when a unit delete is refused.
 * A7's worked example: "Không xoá được đơn vị Combo 2 vì đang được dùng
 * trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy
 * đổi đó trước."
 */
export function buildUnitDeleteRestrictionMessage(unitName: string, finding: UnitBlockerFinding): string {
  return `Không xoá được đơn vị ${unitName} vì đang được dùng trong ${clauseFor(finding)}. ${hintFor(finding)}`;
}
