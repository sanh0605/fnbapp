# The owner should never be shown an error he cannot act on

**Written 2026-08-26 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1), in particular §3's scope decision — 43 sites is a lot, and if
a narrower cut is better, argue it rather than doing all of them badly.

## 1. What happened

The owner entered a purchase order for consumables, pressed save, and got a
dialog reading:

> **Lỗi:** `findAll(Item_Categories): JWT issued at future`

He worked out the real cause himself: **he had not chosen a nguồn nhập
(purchase source)**. His own words: *"nó hiển thị lỗi như này anh sẽ không biết
anh cần làm gì."*

That is the defect. Not the JWT text — the fact that a business user was handed
a technical string with no relation to what he did wrong and no instruction.

## 2. Two causes, both real

**(a) The form never validates the source.**
`app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx` checks
the supplier (line 181), that at least one line exists (182), and each line's
fields (187). `source_id` is read into state at line 65 and appended to the
payload at line 198 — and **never checked**. So an empty source reaches the
server and fails somewhere downstream, far from the cause.

**(b) Server actions return raw exception text straight to the screen.**
The pattern `error instanceof Error ? error.message : "Unknown error"` appears
in **43 places** across `app/`. Whatever a library throws — a Supabase auth
message, a Postgres constraint name, a stack-trace fragment — is what the owner
reads.

**The JWT message itself is unexplained and this plan does not pretend
otherwise.** Investigating it established only that the legacy Supabase keys
were disabled on **2026-04-14** (verified by calling the REST API with each key:
the new `sb_secret_…` returns 200, the legacy JWT returns 401 *"Legacy API keys
are disabled"*), which is a different message from the one he saw. Do not build
a fix around a diagnosis nobody has.

## 3. What to change

**First, the specific case.** Validate `source_id` beside the existing checks,
with the same shape and wording as its neighbours:
*"Vui lòng chọn nguồn nhập hàng"*. This alone would have replaced the dialog he
saw with an instruction he could follow.

**Then the general one, and this is the part worth arguing about.** 43 call
sites is too many to change well in one pass, and a mechanical rewrite would
produce 43 vague messages, which is not obviously better than 43 precise
technical ones.

Proposed cut, but **critique it**: leave the raw text in place as a *detail*,
and put a plain-Vietnamese sentence in front of it. One shared helper that turns
a caught error into `{ message, detail }`, where `message` is what the owner
reads and `detail` is what an engineer needs. The dialog shows the message and
hides the detail behind an expander.

That way nothing is lost, no message has to be invented per site, and the owner
stops being handed a string he cannot act on.

**Recognise the cases that already have good wording** — a duplicate-name
refusal already says *"Tên này đã có rồi"*. Those must pass through unchanged.

## 4. Also found, record but do not fix here

`lib/supabase.ts:22-24` falls back from `SUPABASE_SECRET_KEY` to
`SUPABASE_SERVICE_ROLE_KEY`. **That fallback is dead** — legacy keys were
disabled project-wide on 2026-04-14, so if it ever fires it produces a 401 with
a message about legacy keys rather than working. It should either be removed or
turned into a startup error that says exactly what is missing. Log it as an
open item; it is not what broke today.

## 5. Verification

- **A test that fails first:** submitting the purchase-order form with no source
  is refused with the Vietnamese message and never reaches the server. Today it
  reaches the server.
- The existing supplier/line/unit checks still fire, in their existing order.
- **A test that a message already written for the owner survives the wrapper** —
  the duplicate-name refusal is the fixture; it must not be replaced by a
  generic sentence.
- Whatever cut §3 lands on, **report the number of sites changed** and say which
  ones were deliberately left alone.
- `CLAUDE.md` §9's four gates. Do not push.

## 6. Done means

`CLAUDE.md` §9 in full, plus §5.
