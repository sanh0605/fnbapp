# "JWT issued at future": survive it, because we cannot fix it

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Owner approved on 2026-08-27 ("sửa luôn chỗ này") after
production logs showed `/admin/reports/sales` returning a rendered error page.

**Investigated with `superpowers:systematic-debugging`. The root cause is not
in this repository.** What is in this repository is the reason a transient
upstream hiccup becomes a broken page.

---

## 1. What the owner saw

Three production failures on deployment `dpl_BnD7xZCnQvvtXyLNApc3AVpxoRTW`,
all the same error, all on different tables:

| UTC | Page | Table |
|---|---|---|
| 2026-08-26 17:31:11 | `/admin/inventory/items` | `Item_Categories`, then `Purchased_Items` on cache revalidation |
| 2026-08-26 18:01:07 | `/admin/reports/sales` | `Users` |
| 2026-08-26 20:39:51 | `/admin/inventory/purchase-orders` | `Suppliers` |

The 18:01 one reached the owner: the server render threw, the client reported
`digest 3575243512` to `/api/client-errors`, and the page showed an error.

**Sonnet hit the same error from a different machine** during the 53-order
import, before any writes.

## 2. Phase 1 — where the JWT comes from

**Nothing in this repository mints a JWT.** Searched `lib/`, `app/` and
`middleware.ts` for `jsonwebtoken`, `jose`, `SignJWT` and `jwt.sign`: no
matches. `lib/supabase.ts` passes an opaque key string straight to
`createClient` and never constructs a token.

So no code here can produce an `iat` in the future. The JWT is minted **inside
Supabase** when the gateway resolves an `sb_secret_…` key, and validated by
PostgREST — which returns `PGRST303` when `iat` is later than its own clock.
The skew is between two of Supabase's own components.

**This is a known, open Supabase issue**, not a misconfiguration here:
[supabase/discussions#48123](https://github.com/orgs/supabase/discussions/48123)
describes exactly this, and Supabase's own guidance is to open a support ticket
with the project ref and the UTC timestamp — see §5.

## 3. What the investigation did NOT show

**It was not reproduced.** 190 sequential live REST calls from this machine
with the production `sb_secret_…` key returned **190 successes, 0 failures**.

That does not clear anything. If the real rate is around 1%, 190 clean calls
happen about 15% of the time by chance. The probe also ran from Vietnam against
a single table, while the failures came from Vercel's `iad1`. **Read it as "not
reproduced here", never as "does not happen".**

Also unestablished: whether the rate is rising, and whether it correlates with
cache revalidation. Two of the three failures happened on a revalidation, which
is suggestive and nothing more — that is also simply when fresh calls happen.

## 4. Phase 1 — what IS ours

`lib/sheets_db.ts`, in `findAll` and its siblings:

```ts
const { data, error } = await query;
if (error) {
  throw new Error(`findAll(${sheetName}): ${error.message}`);
}
```

**There is no retry anywhere in the data layer.** Grepped `lib/` and `app/` for
`retry`/`backoff`: the only hits are the POS offline queue and comments in
historical tooling. One transient upstream failure becomes a thrown Error,
which becomes a failed server render, which becomes an error page.

**That is the defect this plan fixes.** Not the skew — the zero tolerance for
it.

## 5. The fix

**Retry transient failures inside the adapter**, not at call sites: `findAll`
is called from **205 places** and none of them should have to know about this.

- **Reads only** — `findAll`, `findAllWhere`, `findAllWhereInBatches`,
  `findById` and any other read helper in `lib/sheets_db.ts`.
- **Never writes.** A write that failed *after* reaching Postgres is
  indistinguishable from one that failed before it, and retrying it can insert
  twice. Purchases and orders are exactly the wrong place to guess. Leave every
  write path alone.
- **Only clearly transient errors.** Match the PostgREST code (`PGRST303`) or
  the message, plus network-level failures. **Do not retry on 401/403** — a
  genuinely wrong key must still fail loudly and immediately, or `OPEN-ITEMS 60`
  becomes invisible instead of merely confusing.
- **Small and bounded:** 2 retries, short backoff (roughly 150ms then 400ms).
  This is a sub-second clock disagreement, not an outage. If it is an outage,
  failing after ~0.5s is correct.
- **Log every retry** with the table name, so the rate becomes measurable
  instead of anecdotal. Today nobody can answer "how often does this happen".

**Write the test first and prove it fails on the unfixed code**
(`CLAUDE.md` §9): a fake client that fails once with `PGRST303` then succeeds
must make `findAll` return rows. State whether the test fails on the **value**
or on a missing function.

Second test, equally required: a fake client that fails with a **401** must
make `findAll` throw **immediately**, with no retry. A retry policy nobody
tested the refusal half of is a policy that quietly swallows a bad key.

## 6. What this fix does not do

It hides a real upstream problem. Say so in `DEVELOPMENT-TRACKING.md` rather
than recording "fixed".

**The owner should also report it to Supabase**, with the project ref and these
three UTC timestamps — `2026-08-26 17:31:11`, `18:01:07`, `20:39:51`. That is
the half of this that can actually make the error stop. Sonnet: do not open the
ticket, and do not ask him to; surface it to the reviewer and let the owner
decide.

## 7. Verification

- Both tests above pass, and the first was proved failing beforehand.
- `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`,
  `npm run build` — `CLAUDE.md` §9 in full, including the build gate.
- No write path gained a retry: show the diff of every changed function and
  confirm each is a read.
- The retry log line appears when the fake client fails once — proved by the
  test, not by reading the code.

## 8. Done means

`CLAUDE.md` §9. Do not push. **And note what deploying this cannot prove:** the
error is rare and not reproducible on demand, so a clean page load afterwards is
not evidence the retry works. The tests are the evidence.
