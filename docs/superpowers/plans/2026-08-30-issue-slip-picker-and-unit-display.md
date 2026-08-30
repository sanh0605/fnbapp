# Issue slip: show stock in the unit being typed, and stop offering what is not there

**Written 2026-08-30 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). **UI only — no data, no migration, no server contract change.**

Both asked for by the owner 2026-08-30 while recording his first consumable
issue slip.

---

## 1. What he asked for

> *"Anh muốn khi đổi đơn vị thì 'tồn hiện tại' cũng sẽ quy đổi theo sao cho phù
> hợp với đơn vị đang chọn. Ngoài ra, sản phẩm chọn để xuất chỉ thấy các sản
> phẩm còn tồn, không thấy các sản phẩm hết tồn."*

His screenshot: **`Ly mập Uchako — Tồn hiện tại: 1.000 Cái`** with **`Cây 50 Cái`**
selected. He is typing a number of *cây* against a stock figure in *cái*, and
has to divide in his head while standing at the shelf.

## 2. Everything needed is already in the payload

`app/admin/inventory/issue-slips/actions.ts:93-99` already returns `onHand` (in
base units), `unitName`, and `packageLines` (the conversions, each with a rate).
**No server change for the display half** — the client can divide.

## 3. Convert the displayed stock

With `Cây 50 Cái` selected against 1.000 Cái, show **20 Cây**.

**Show both, do not replace.** `Tồn hiện tại: 20 Cây (1.000 Cái)`. The base
figure is what every other screen and every refusal message uses; hiding it
would make a rejection ("còn 1.000") unreadable against what the screen said.

**Rounding, set by the owner 2026-08-30:** show the exact value when the
division is clean (`20,6`), and **two decimal places** when it is not
(`20,62`). Vietnamese comma. Never round to a whole number.

**This is a mistake guard, not a convenience — and that is the stronger
reason.** Verified at `IssueSlipClient.tsx:163`: the form submits
`parsedQty * pkg.conversionRate`, so with `Cây 50 Cái` selected, typing 10
issues **500**. A screen showing `Tồn hiện tại: 1.000 Cái` beside a box that
means *cây* invites typing 1.000 — **50.000 cái, fifty times the intent**. The
server refuses only when the result exceeds stock; when stock is large enough it
passes, and the error is silent. `Ly mập Uchako` is exactly this shape: two
conversions, `Cái` at rate 1 and `Cây` at rate 50.

**Rate 1 conversions change nothing** — 26 of the consumables are `Cái 1 Cái`,
and `20 Cái (1.000 Cái)` is noise. When the rate is 1, show the base figure
alone.

## 4. Stop offering items with nothing in them

**Measured 2026-08-30: 110 active items have stock, 36 have none.** The picker
currently offers all 146 — `filterByC17` drops a zero-stock item only if it is
already inactive.

Offering a zero-stock item offers something the server will always refuse:
`create_issue_slip_atomic` raises *"chưa có đơn nhập nào tính tới thời điểm"* or
the over-issue error every time. **A choice that cannot succeed should not be
in the list.**

**Filter in the issue-slip screen, not in `filterByC17`.** That helper is shared
with **stocktake, which must keep showing zero-stock items** — counting exists
precisely to find out that the system's zero is wrong. Putting the rule in the
shared helper would silently remove from the count sheet everything the count is
most likely to correct.

**Use the issue date, not today.** The screen already lets him backdate a slip,
and the server checks stock *as of* `p_issued_at`. If the filter uses today's
on-hand while the server uses the issue date's, the list and the refusal will
disagree — and the refusal wins. If the payload cannot express that, say so and
filter on today's, but say it rather than shipping a quiet mismatch.

## 5. Verification

- **Test first, failing on the value:** with a 50-per-Cây conversion selected
  against 1.000 base units, the label reads `20 Cây (1.000 Cái)`. Today it reads
  `1.000 Cái` regardless. State whether the pre-fix failure was the value or a
  missing element.
- **Non-exact division rendered, not rounded away:** 1.030 shows `20,6`.
- **Rate 1 shows the base figure alone**, not doubled.
- **A zero-stock item is absent from the issue picker and still present on the
  stocktake screen** — one test each, because the second is what stops this
  being copied into the shared helper later.
- Both layouts (`CLAUDE.md` §7): he is on a phone at the shelf, and the desktop
  table must show the same thing.
- Full `CLAUDE.md` §9.

## 6. Done means

`CLAUDE.md` §9. Do not push without approval. **Then he records the slip from
his screenshot on a phone** — that is the situation this exists for.
