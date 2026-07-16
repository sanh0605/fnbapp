# Task: UI-REMED-3 Verification Checklist

## Context

UI-REMED-3 Session 1 + Session 2 đã close (commits `dd51dae` + `2f91b3f`). 54 native `alert()` / `confirm()` migrated sang imperative Dialog API. Tests pass, TS clean, build OK.

User requests full verification pass: Antigravity chạy checklist 20 câu hỏi test → report → Claude review lần nữa.

## Verification method

- **Test environment**: dev server `npm run dev`, browser Chrome
- **Viewports**: desktop 1280px + mobile 375px
- **For each question**: record PASS / FAIL / N/A + screenshot if FAIL + note
- **Stop-and-ping**: if any FAIL → stop, document, ping Claude

## Checklist (20 questions)

### A. Critical UX flows (8 questions)

1. **POS add to cart + checkout** — Thêm 2-3 sản phẩm vào cart, click "Thanh toán". Dialog xác nhận hiện đúng? Click Xác nhận → xử lý order thành công?

2. **POS remove item from cart** — Click Xóa item trong cart. Dialog xác nhận xóa hiện? Click Xác nhận → item bị xóa khỏi cart?

3. **POS checkout success** — Checkout thành công. Dialog success "Đơn hàng đã tạo" hoặc tương đương hiện?

4. **POS checkout error** — Simulate error (tắt network, submit). Dialog danger "Có lỗi xảy ra" hiện?

5. **Purchase Order submit - validation** — Mở `/admin/inventory/purchase-orders/new`, click Save mà không điền gì. Dialog warning "Vui lòng điền..." hiện?

6. **Purchase Order submit - success** — Điền form hợp lệ, Save. Dialog success hiện?

7. **Stock Adjustment delete** — Mở `/admin/inventory/stock-adjustments`, click Xóa entry. Dialog confirm "Bạn có chắc..." hiện? Click Xác nhận → entry bị xóa?

8. **Form validation (any form)** — Test 1 form bất kỳ (ProductForm, ProductionForm, etc.) submit thiếu required field. Dialog warning hiện đúng?

### B. Dialog variants correctness (3 questions)

9. **Variant info (success)** — Trigger 1 success dialog (vd: PO save OK). Icon + button màu xanh primary? Style consistent?

10. **Variant warning (validation)** — Trigger 1 validation error. Icon + button màu vàng warning?

11. **Variant danger (critical)** — Trigger 1 critical error (vd: sync lỗi). Icon + button màu đỏ danger?

### C. Dialog interactions (3 questions)

12. **ESC key dismiss** — Mở dialog, nhấn ESC. Dialog đóng? Hành động hủy (giống click Cancel/Huỷ)?

13. **Click outside dismiss** — Mở dialog, click vào backdrop bên ngoài. Dialog đóng?

14. **Focus trap** — Mở dialog có nhiều controls, nhấn Tab nhiều lần. Focus có loop trong dialog không thoát ra ngoài?

### D. Mobile (375px) (3 questions)

15. **Bottom-sheet style** — Mobile 375px, mở dialog. Dialog dính đáy màn hình (bottom-sheet) hay centered?

16. **No horizontal scroll** — Mobile 375px, dialog với message dài. Có horizontal scroll không?

17. **Touch target size** — Mobile, buttons "Huỷ" / "Xác nhận" trong dialog. Touch target >= 44px height?

### E. Queue + async sanity (3 questions)

18. **Queue: rapid double trigger** — Click Save 2 lần liên tiếp nhanh. Có phải dialog xếp hàng (thứ 2 chờ thứ 1 đóng xong) không? Hay cả 2 stack lên nhau?

19. **Console errors** — Mở DevTools Console. Có warning/error về "Promise returned in event handler" hoặc unhandled Promise rejection khi triggers dialog?

20. **Long message scroll** — Trigger dialog với message rất dài (vd: error message 100+ ký tự). Nội dung scroll được trong dialog, không tràn viewport?

## Report format

Antigravity report back in this structure:

```
## UI-REMED-3 Verification Report

### Summary
- Total tests: 20
- PASS: N
- FAIL: N
- N/A: N

### Per-question results
1. PASS - <short note>
2. PASS - <short note>
...
N. FAIL - <description> + screenshot: <path>

### Critical issues found (if any)
- <issue description>
- <affected file/function>
- <suggested fix>

### Next step recommendation
- If 0 FAIL: verification passed, ready to close
- If FAIL: list specific issues for Claude review
```

## After Antigravity report

Claude reviews the report:
- 0 FAIL → close verification, UI-REMED-3 saga confirmed complete
- FAIL → analyze each issue, decide: hotfix / new task / accept as known issue

## Constraints

- **Do NOT modify code in this verification pass** — pure read/test only.
- **If find critical bug**: stop, document, ping Claude (don't try to fix on the side).
- **Screenshots for FAIL**: save to `scratch/verify-ui-remed-3/` (gitignored) and reference path in report.

## Priority

P1 — verification pass before considering UI-REMED-3 fully closed. Antigravity pickup. ~1-2 hours.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (Medium)` — systematic test execution + reporting.
