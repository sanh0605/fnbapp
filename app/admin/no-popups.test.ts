import { describe, it } from "vitest";

// BR-DATA-007 (owner 2026-09-30, narrowed 2026-10-01): an admin box with an
// input, or one only for viewing, becomes a page. Yes/no confirmations and
// error boxes stay (DeleteConfirmModal, confirm()/alert() in lib/shared/dialog).
// Turn this todo into a guard that scans app/admin for FormModal / ModalPortal /
// window.confirm / window.alert once the last screen group is converted.
// POS (app/pos) is exempt.
describe("BR-DATA-007 no popups on admin screens", () => {
  it.todo("Khung có ô nhập hoặc khung xem ở trang quản trị thành trang riêng; câu hỏi có/không và báo lỗi vẫn bật khung (BR-DATA-007, chủ quán chốt 30/09 và 01/10/2026)");
});
