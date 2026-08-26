# Outlets, done properly — one piece of work, not three patches

**Written 2026-08-26 by Opus 5.** **Supersedes
`docs/superpowers/plans/2026-08-26-outlet-edit-all-fields.md`**, which is
withdrawn. Handoff to Sonnet 5. Critique before coding (`CLAUDE.md` §1),
especially §3's claim that the drafts change costs nothing today.

## 1. Why this replaces three separate handoffs

The owner opened the outlet screen and found, in one sitting: it only renames;
it has no operating hours; and drafts are keyed to the wrong thing. His verdict
was that this was built to look finished rather than to be used — *"căn bản em
chỉ đang làm cho có chứ không phải là đang giúp đỡ anh"* — and the drafts case
proves it. The response to finding that drafts filter by brand was to propose a
**warning dialog**, i.e. to guard the symptom while leaving the wrong key in
place. Measured afterwards: **`pos_drafts` holds 0 rows**, so the warning would
have protected a situation that has never occurred, while the correct fix is
free precisely now.

Three patch plans would repeat the same mistake at a smaller scale. One piece of
work, covering what an outlet actually needs.

## 2. Operating hours belong to the outlet, not the brand

**Owner, 2026-08-26:** *"mỗi điểm bán mới có thời gian hoạt động, chứ brand thì
không có thời gian hoạt động."*

This is simpler than
`docs/superpowers/specs/2026-07-28-multi-outlet-design.md`, which put
`start_time`/`end_time` on an `Outlet_Brand_Slot`. Under the owner's model the
two brands separate themselves because their outlets keep different hours — the
time window has no reason to live on the pairing. **The spec's slot table
remains the path if one outlet ever sells two brands at different times of day;
it is not needed for that today and must not be built speculatively.**

**Add to `outlets`:** `open_time` and `close_time` (time of day, nullable —
null on both means no stated hours and no check).

**Do not seed them with guessed values.** Sales cluster at 06:00–09:00 and
17:00–21:00, but that is when customers *bought*, not when the shop *opened*.
The owner fills these in on the screen; the field exists so he can, which is
`CLAUDE.md` §7's rule about flexible things.

### What the hours must actually do

A field nothing reads is decoration. On the "MỞ MÁY POS" picker
(`app/admin/layout.tsx`), mark each outlet as open or closed against the current
Saigon time, and **ask for confirmation before opening a till at a closed
outlet** — do not block it, since the shop may genuinely trade late.

The error this prevents is concrete: picking the wrong outlet books revenue
against the wrong one, and the per-outlet breakdown shipped on 2026-08-25 exists
precisely to compare the two.

**Timezone:** use `Asia/Ho_Chi_Minh` explicitly. `OPEN-ITEMS 57` and the chart
bug fixed the same day are both this mistake; do not make it a third time.

## 3. Drafts belong to the outlet

`pos_drafts` carries `brand_id` and no outlet. Drafts are filtered by it
(`app/pos/actions.ts:263`, `:302`). But a draft belongs to **the till it was
started at**, and the brand is only what happened to be stamped at that moment —
the owner's own point.

Add `outlet_id` to `pos_drafts` and filter on it. **Measured 2026-08-26:
`pos_drafts` has 0 rows**, so there is no backfill and no migration risk. Verify
that count immediately before writing the migration rather than trusting this
line; if it is non-zero the change needs a backfill plan and this section is
wrong.

Keep `brand_id` on the draft — it is the sale-time fact, same as on an order.

## 4. Editing an outlet

Show brand, address, start date **and the new hours** when editing, not the name
alone. Retitle the action **"Sửa điểm bán"**.

`code` stays immutable and displayed, with one line saying why: it is embedded
in the order code of every sale minted at that outlet.

**Changing the brand is safe and was traced, not assumed.** `outlets.brand_id`
is read in exactly two places, both at sale time (`app/pos/actions.ts:76`,
`app/pos/page.tsx:36`); everything downstream reads the brand frozen on the
order (`app/admin/reports/actions.ts:126`, `:368`). So the change moves future
sales only.

## 5. Verification

- **Render tests that fail first:** the edit form shows brand, address, start
  date and both hour fields; today it shows only the name.
- **Hours:** an outlet open 06:00–11:00 reads as open at 07:00 Saigon and closed
  at 15:00, proven with a fixed clock rather than the machine's own time. Null
  hours never mark an outlet closed.
- **The closed-outlet confirmation appears and can be accepted**, and accepting
  it still opens the till — a guard that blocks would be worse than none.
- **Drafts:** a draft created at one outlet is not listed at another; re-verify
  the 0-row count before the migration and report it.
- `code` cannot be changed by posting a different value, not merely disabled in
  the form.
- `CLAUDE.md` §9's four gates. Do not apply the migration, do not push.

## 6. Done means

`CLAUDE.md` §9 in full, plus §5. One commit for the migration, one for the
screens, so either can be reverted alone.
