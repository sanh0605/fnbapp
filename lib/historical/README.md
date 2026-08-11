# `lib/historical/`

Everything under this directory is code that no longer runs. It stays for
three reasons, all of which must hold before anything is added here:

1. **It ran against real production data.** Either as a one-off repair or
   audit script from Plans A–D (correcting the stock ledger, recomputing
   backdated cost, migrating orders from V1 to V2, and similar), or as
   retired application code that was once part of the live path (a checkout
   step, a password-verification routine) before it was replaced.
2. **It is the record of what was done, not a utility.** `CLAUDE.md`
   section 2 protects master data from deletion; this directory protects the
   same thing one layer down — the code that explains *why* a row in
   `stock_ledger` or `data_recovery_changes` looks the way it does. Deleting
   it would not delete any data, but it would delete the ability to explain
   the data that is left.
3. **Nothing here should be imported by new code.** If a script under here
   looks like it does something a new feature needs, that is a sign the new
   feature needs its own module, not a call into a closed one-off tool built
   for a specific past correction.

## How this list was built

`docs/audits/2026-08-10-lib-reachability-classification.md` — a full
breadth-first walk from every real entry point in this repo (Next.js
special files, the three Supabase Edge Functions, the one script wired into
`.husky/pre-commit`), distinguishing type-only edges (erased at compile
time) from real value edges. Everything moved here was `spent` (still
imported by something, almost always a `scripts/` file, but reachable from
no root) or `orphan` (imported by nothing at all) in that classification —
never `live` or `type-only`.

Not listed file-by-file here on purpose — a list rots the moment one more
module is added or an old one is finally deleted; the criterion above does
not. To see what is here today, list the directory. To see why a specific
file is here, read its own header comment — every file kept a note, or
gained one during the move, saying what it did and when it last ran.
