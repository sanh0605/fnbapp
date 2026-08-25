# The POS still announces the order code on success

**Written 2026-08-25 by Opus 5.** Handoff to Sonnet 5. One line, but it is a
live defect against an explicit owner instruction, found by the owner testing
the deployed build.

---

## 1. The instruction, and what ships today

Owner, specifying the outlet work on 2026-08-25:

> *"Khi nhân viên bấm tạo đơn thành công sẽ không thông báo mã đơn mà chỉ thông
> báo thành công."*

`docs/superpowers/plans/2026-08-24-outlets-and-order-code.md` §1 records it.
Nothing implemented it — `components/POSScreen.tsx:787` still reads:

```ts
addToast("success", `Thanh toán thành công! Mã đơn: ${res.order_no || ""}`);
```

The owner confirmed it on the deployed build: *"CÓ HIỂN THỊ, NHƯNG VẪN CÒN HIỆN
MÃ ĐƠN."*

**This one was missed in review too** — the plan carried the instruction, the
implementation did not act on it, and neither the implementer's report nor this
reviewer's independent pass caught it. It took the owner opening the till.

## 2. The change

Drop the code from the message; keep the toast:

```ts
addToast("success", "Thanh toán thành công!");
```

**Scope is exactly that line.** Checked before writing this: it is the only
success message in the POS that mentions the code. The offline path
(`POSScreen.tsx:837`, *"Đã lưu đơn hàng, sẽ gửi khi có mạng trở lại."*) is
already correct and must not change. `res.order_no` has no other consumer in
`POSScreen.tsx`, but leave the server action returning it — the field is part of
the action's contract and other callers may rely on it; removing it is a
different, larger change with no reason behind it.

The code stays visible everywhere an order is looked up afterwards. Only the
moment of sale goes quiet.

## 3. Verification

- **A render test that fails first.** Assert the success toast's text does
  **not** contain the order code, and does contain *"Thanh toán thành công"*.
  Run it against the current code, confirm it fails, and say whether it fails
  on a wrong value or a missing symbol.
- The offline-save toast keeps its own wording — cover it in the same test so a
  future edit cannot quietly collapse the two messages into one.
- `CLAUDE.md` §9's four gates.
- `OPEN-ITEMS 46` applies: assert on rendered output, not on a submit event.

## 4. Done means

`CLAUDE.md` §9 in full. Do not push — the owner approves each push, and this one
will want deploying quickly, so say when it is ready rather than assuming.
