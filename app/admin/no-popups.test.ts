import { describe, it } from "vitest";

// BR-DATA-007 (owner 2026-09-30): admin screens never open a popup. Turn this
// todo into a guard that scans app/admin for Dialog / FormModal /
// DeleteConfirmModal / ModalPortal / window.confirm / window.alert once the
// last screen group is converted. POS (app/pos) is exempt.
describe("BR-DATA-007 no popups on admin screens", () => {
  it.todo("Bỏ mọi popup ở trang quản trị: khung có ô nhập thành trang riêng, câu xác nhận ngắn hỏi ngay trên trang (BR-DATA-007, chủ quán chốt 30/09/2026)");
});
