import { formatDate, formatDateTime } from "@/lib/shared/datetime";

// BR-INV-015: turns the JSON of purchase_order_cancel_check and
// cancel_purchase_order_atomic (migration 0108) into typed values and the
// Vietnamese sentences the owner reads.

export const CANCEL_REASON_MAX = 500;

export type CancelBlocker =
  | { code: "NOT_FOUND" }
  | { code: "ALREADY_CANCELLED" }
  | { code: "STOCKTAKE"; stocktakeId: string; confirmedAt: string; orderAt: string }
  | { code: "NEGATIVE"; itemId: string; itemName: string; lowBalance: number; lowAt: string; orderQty: number; baseUnit: string }
  | { code: "DISPOSED"; assetId: string; name: string };
export type CancelAsset = { id: string; name: string; quantity: number; totalCost: number };
export type CancelCheck = { blocked: CancelBlocker[]; assets: CancelAsset[] };
export type CancelOutcome =
  | { cancelled: true; retiredAssetIds: string[] }
  | { cancelled: false; blocked: CancelBlocker[] };

const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Cancel check: "${key}" is not text`);
  return value;
}

// Postgres numeric arrives as a number or a numeric string.
function num(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new Error(`Cancel check: "${key}" is not a number`);
  return n;
}

function parseBlocker(raw: unknown): CancelBlocker {
  if (!isRecord(raw)) throw new Error("Cancel check: a blocker is not an object");
  switch (raw.code) {
    case "NOT_FOUND":
      return { code: "NOT_FOUND" };
    case "ALREADY_CANCELLED":
      return { code: "ALREADY_CANCELLED" };
    case "STOCKTAKE":
      return { code: "STOCKTAKE", stocktakeId: text(raw, "stocktake_id"), confirmedAt: text(raw, "confirmed_at"), orderAt: text(raw, "order_at") };
    case "NEGATIVE":
      return {
        code: "NEGATIVE",
        itemId: text(raw, "item_id"),
        itemName: text(raw, "item_name"),
        lowBalance: num(raw, "low_balance"),
        lowAt: text(raw, "low_at"),
        orderQty: num(raw, "order_qty"),
        baseUnit: text(raw, "base_unit"),
      };
    case "DISPOSED":
      return { code: "DISPOSED", assetId: text(raw, "asset_id"), name: text(raw, "name") };
    default:
      throw new Error(`Cancel check: unknown blocker code ${String(raw.code)}`);
  }
}

function parseBlockers(raw: unknown): CancelBlocker[] {
  if (!Array.isArray(raw)) throw new Error("Cancel check: blocked is not a list");
  return raw.map(parseBlocker);
}

function parseAsset(raw: unknown): CancelAsset {
  if (!isRecord(raw)) throw new Error("Cancel check: an asset is not an object");
  return { id: text(raw, "id"), name: text(raw, "name"), quantity: num(raw, "quantity"), totalCost: num(raw, "total_cost") };
}

export function parseCancelCheck(raw: unknown): CancelCheck {
  if (!isRecord(raw)) throw new Error("Cancel check: not an object");
  if (!Array.isArray(raw.assets)) throw new Error("Cancel check: assets is not a list");
  return { blocked: parseBlockers(raw.blocked), assets: raw.assets.map(parseAsset) };
}

export function parseCancelOutcome(raw: unknown): CancelOutcome {
  if (!isRecord(raw)) throw new Error("Cancel outcome: not an object");
  if (raw.cancelled === true) {
    const ids = raw.retired_asset_ids;
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) {
      throw new Error("Cancel outcome: retired_asset_ids is not a list of text");
    }
    return { cancelled: true, retiredAssetIds: ids as string[] };
  }
  if (raw.cancelled === false) return { cancelled: false, blocked: parseBlockers(raw.blocked) };
  throw new Error("Cancel outcome: cancelled is neither true nor false");
}

export function describeCancelBlocker(b: CancelBlocker): string {
  switch (b.code) {
    case "NOT_FOUND":
      return "Không tìm thấy phiếu nhập.";
    case "ALREADY_CANCELLED":
      return "Phiếu đã huỷ rồi.";
    case "STOCKTAKE":
      return `Phiếu ngày ${formatDate(b.orderAt)} nằm trước lần kiểm kê ${b.stocktakeId} (${formatDate(b.confirmedAt)}), nên không huỷ được: lần kiểm kê đã đếm lại hàng trên kệ.`;
    case "NEGATIVE":
      return `Huỷ phiếu này làm tồn kho âm: ${b.itemName} lúc thấp nhất (${formatDateTime(b.lowAt)}) chỉ còn ${quantityFormat.format(b.lowBalance)} ${b.baseUnit}, phiếu có ${quantityFormat.format(b.orderQty)} ${b.baseUnit}. Hàng của phiếu đã được dùng, nên phiếu này là thật.`;
    case "DISPOSED":
      return `Tài sản ${b.assetId} ${b.name} của phiếu đã thanh lý, nên không huỷ được phiếu.`;
  }
}

export function validateCancelReason(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = (input ?? "").trim();
  if (value === "") return { ok: false, error: "Lý do huỷ phiếu là bắt buộc" };
  if (value.length > CANCEL_REASON_MAX) return { ok: false, error: "Lý do huỷ tối đa 500 ký tự" };
  return { ok: true, value };
}
