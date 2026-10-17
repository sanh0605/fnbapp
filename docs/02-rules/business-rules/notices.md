# Notices

How a screen tells the user that something worked, failed, is still saving, or needs a look. The rest of the screen rules are in `docs/02-rules/business-rules/screens.md`.

### BR-UI-020 — One notice style

**Status:** `APPROVED` — chosen on the owner's behalf under his 2026-10-15 delegation, with the till redo (mockup A). On his end-of-batch review list. Pushed 2026-10-17.

- Every notice that pops up and goes away uses the shared `components/ui/Toast.tsx`: an icon, a bold title, an optional detail line, and a ✕ to close.
- Four kinds, each with its own colour and icon: success (brown), error (red), warning (dark yellow `#9A6700`), info (slate blue `#3B5B7A`).
- Success and info close after 3 seconds, a warning after 5. An error stays until it is closed, so a failed order is never missed.
- At most three notices that are not errors show at once; the oldest goes first. Errors are never pushed out.
- The till uses it from 2026-10-17. Admin pages switch to it as each area is redone; until then they keep their own messages.

### BR-UI-021 — A save button cannot be pressed twice

**Status:** `APPROVED` — owner 2026-10-14: *"nút đó sẽ biến thành 2 dấu mũi tên đang xoay tròn, và không bấm lại được để tránh tình trạng duplicate đơn hàng"*. Built 2026-10-14 in `25ef73df`, pushed in `feebd7ee`. Shared button `components/ui/Button.tsx`; tests in `components/ui/Button.test.tsx` ("is switched off while loading", "while loading shows only the two turning arrows…", "shows no arrows when not loading").

- While saving, the button's words give way to two turning arrows and the button cannot be pressed.
- On Phiếu nhập, Phiếu xuất, Sổ thu chi, Chuyển tiền and Thanh lý it stays that way until the page moves on, instead of coming back as soon as the server answers.
- A failed save brings the button back with a Vietnamese message.
