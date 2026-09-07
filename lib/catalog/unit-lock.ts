/**
 * section 4:
 * a purchased item's base unit is free to choose until the item has real
 * history recorded in it -- purchase_order_lines.base_quantity and
 * stock_issues.base_quantity are both stored in base units, so re-pointing
 * an item from one unit to another silently reinterprets every quantity
 * ever recorded for it.
 *
 * Unlike the product stop-selling rule, nothing at the schema level
 * notices a unit changing meaning -- there is no foreign key that would
 * refuse this. This is the one real check standing between a base-unit
 * edit and a silently wrong on-hand figure, so it is a single shared
 * function rather than two independently-drifting per-screen checks
 * (app/admin/inventory/items/actions.ts and
 * app/admin/inventory/conversions/actions.ts both call it).
 *
 * Checks both purchase_order_lines and stock_issues, not only the former:
 * measured 2026-08-29, every item with a stock_issues row also has a
 * purchase_order_lines row today (0 issue-only items), so this is not
 * closing a live exposure -- but the check is free to include, and a
 * stocktake can in principle find stock for an item that was never
 * purchased, which would be exactly that shape.
 */

export interface UnitLockInputs {
  /** This item's own uom_conversions rows (any subset of fields is fine, only base_unit is read). */
  itemConversions: Array<{ base_unit?: string }>;
  hasPurchaseOrderLine: boolean;
  hasStockIssue: boolean;
}

export interface UnitLockResult {
  /** True when the base unit must not change. */
  locked: boolean;
  /**
   * The item's current base unit, read from its own existing conversions
   * (every one of the 146 real items today has its conversions agree on
   * exactly one base_unit -- verified 2026-08-29, not assumed). Null when
   * the item has no conversions yet, in which case there is nothing on
   * record to protect and `locked` is false regardless of history.
   */
  currentBaseUnitId: string | null;
}

export function resolveUnitLock(inputs: UnitLockInputs): UnitLockResult {
  const currentBaseUnitId = inputs.itemConversions[0]?.base_unit || null;
  const hasHistory = inputs.hasPurchaseOrderLine || inputs.hasStockIssue;
  return {
    locked: hasHistory && currentBaseUnitId !== null,
    currentBaseUnitId,
  };
}

/**
 * True when a save should be refused: the item is locked and the submitted
 * base unit differs from what is already on record.
 */
export function unitChangeIsRefused(lock: UnitLockResult, submittedBaseUnitId: string): boolean {
  return lock.locked && lock.currentBaseUnitId !== submittedBaseUnitId;
}

export function unitLockRefusalMessage(currentUnitName: string): string {
  return (
    `Không thể đổi đơn vị gốc của mặt hàng này vì đã có phiếu nhập hàng hoặc phiếu xuất kho ghi số lượng ` +
    `theo đơn vị "${currentUnitName}". Đổi đơn vị sẽ làm sai lệch toàn bộ số liệu đã ghi trước đó.`
  );
}
