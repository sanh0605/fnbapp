// Turns a caught exception into what a server action returns, so the
// owner is never shown a raw technical string with no relation to what he
// did wrong.
// section 3.
import type { ActionResponse } from "@/lib/db/shared-actions";

const GENERIC_MESSAGE =
  "Có lỗi xảy ra, vui lòng thử lại. Nếu vẫn còn lỗi, báo cho người quản lý kỹ thuật kèm theo việc anh vừa làm.";

// Every deliberately-written message in this codebase is Vietnamese --
// CLAUDE.md's own rule for anything the owner reads, followed both by
// validation checks written directly in TypeScript and by the RAISE
// EXCEPTION guards inside this app's "atomic" Postgres RPCs (confirmed
// against real fixtures: create_issue_slip_atomic's I4/I5/I10 refusals,
// reverse_stocktake_session_atomic's U2-U4 refusals -- all Vietnamese,
// all meant to reach the owner verbatim, all already covered by existing
// tests that this file's own test suite pins). Every known raw/technical
// exception (a Supabase auth message, a Postgres schema/constraint error,
// a bare "Unknown error") is plain ASCII English, because none of those
// libraries ever emit Vietnamese. A non-ASCII character is therefore the
// signal that distinguishes "written for the owner" from "not" -- not a
// generic heuristic, a fact about this specific codebase's own convention.
function looksHandWrittenForTheOwner(message: string): boolean {
  return /[^\x00-\x7F]/.test(message);
}

// Database refusals added in migration 0132. The db layer keeps only the message text, so the
// key is a piece of it: the constraint name, or the column for a NOT NULL.
const CONSTRAINT_MESSAGES: [string, string][] = [
  ["uom_conversions_rate_positive", "Tỷ lệ quy đổi phải lớn hơn 0."],
  ["purchase_order_lines_money_not_negative", "Đơn giá, thành tiền và số lượng của dòng nhập không được âm."],
  ["stock_issues_session_matches_source", "Dòng xuất kho không khớp với phiên kiểm kê. Tải lại trang rồi thử lại."],
  ["stock_issues_manual_one_link", "Dòng xuất kho tay phải thuộc một phiếu xuất hoặc một lần đảo. Tải lại trang rồi thử lại."],
  ["ux_stock_issues_reverses", "Dòng xuất kho này đã được đảo rồi, không đảo hai lần."],
  ["assets_quantity_positive", "Số lượng tài sản phải lớn hơn 0."],
  ["assets_term_positive", "Thời gian khấu hao phải lớn hơn 0 tháng."],
  ["assets_costs_not_negative", "Đơn giá và tổng giá tài sản không được âm."],
  ["asset_depreciation_bands_min_unique", "Hai bậc khấu hao không được có cùng mức giá từ."],
  ["asset_depreciation_bands_min_not_negative", "Mức giá từ của bậc khấu hao không được âm."],
  ['column "category_id" of relation "products"', "Món phải thuộc một nhóm món."],
  ["ux_product_categories_active_name", "Đã có nhóm món đang dùng với tên này."],
  ["product_variants_price_not_negative", "Giá bán của cỡ món không được âm."],
  ["modifiers_price_not_negative", "Giá của topping không được âm."],
  ["promotions_dates_ordered", "Ngày kết thúc khuyến mãi không được trước ngày bắt đầu."],
  ["promotions_value_valid", "Giá trị giảm không được âm, và giảm theo phần trăm không quá 100."],
  ["promotions_min_order_not_negative", "Đơn tối thiểu của khuyến mãi không được âm."],
];

// Logged server-side only for the sites this function actually genericizes
// -- a message already judged fit for the owner explains itself and needs
// no duplicate; the raw ones are exactly what an engineer would otherwise
// have lost.
export function describeActionError(error: unknown): ActionResponse {
  const raw = error instanceof Error ? error.message : String(error);

  const known = CONSTRAINT_MESSAGES.find(([key]) => raw.includes(key));
  if (known) return { error: known[1] };

  if (looksHandWrittenForTheOwner(raw)) {
    return { error: raw };
  }

  console.error("[ActionError]", error);
  return { error: GENERIC_MESSAGE, errorDetail: raw };
}
