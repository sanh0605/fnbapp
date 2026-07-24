# Repository Structure Audit + Infrastructure Direction Plan

Date: 2026-07-24
Author: Claude coordinator (Fable), plan only — implementation routed per owner's
standing directive (Codex = engine/deps/config, Claude Sonnet 5 = routine moves/UI).
Owner questions answered here:
1. Audit the current directory structure; what is the best target structure?
2. Infrastructure plan: language, keep Vercel or switch, and related platform choices.

Method: read-only survey of the worktree (file counts per directory, git-tracked vs
ignored, import cross-references via grep, config inspection). No files moved,
no code changed. Per the D8 preservation rule, every move/delete below is a
proposal requiring explicit owner approval before any agent acts.

---

## Part 1 — Repository structure audit

### Baseline (2026-07-24)

| Directory | Tracked files | State |
|---|---|---|
| `app/` | 162 | Healthy: standard App Router layout, domain-grouped under `app/admin/*` |
| `components/` | 46 | Healthy post UI-CLEAN-1 (9 dead forms deleted); domain subdirs exist (`pos/`, `inventory/`, `ui/`, `backdated-ledger/`) |
| `lib/` | 186 (~85 modules + 101 test files) | Flat; mixes permanent engine code with closed one-off operation modules — see RS-2 |
| `scripts/` | 186 | Regrew from 133 (2026-07-20 cleanup) in 4 days — see RS-3 |
| `docs/` | 258 (audits 118, handoffs 73) | Healthy: FILE-ORGANIZATION.md conventions hold; growth is by design |
| `supabase/migrations/` | 36 | Canonical migration chain 0001–0036 |
| `migrations/` (root) | 6 | Legacy pre-CLI leftovers (019–023 numbering) — see RS-1 |

Root is clean apart from RS-1/RS-5 items; logs (`migration-*.log`, `re-migrate.log`),
`coverage/`, `recovery-snapshots/`, `tsconfig.tsbuildinfo` are all git-ignored.

### Findings

**RS-1 (Medium, cheap). Legacy root `migrations/` directory shadows the canonical chain.**
6 tracked files (`019_reset_schema.sql` … `023_add_sheets_settings.sql`) using the
pre-Supabase-CLI numbering scheme, superseded by `supabase/migrations/0001–0036`.
Zero code references (grep across `app/`, `lib/`, `scripts/`, configs). Risk: an
agent or the owner grepping for migrations finds two chains and trusts the wrong
one. Proposal: delete the directory (git history preserves full content) and note
the deletion in `docs/audits/archive-scripts.md`'s style. Owner approval required.

**RS-2 (Medium, the main structural debt). `lib/` is flat and mixes lifecycles.**
~85 source modules in one directory spanning three very different lifecycles:
- Permanent engine: `inventory-consumption.ts`, `mac-cogs.ts`, `full-history-recompute.ts`,
  `order-cart.ts`, `order-edit-transaction.ts`, `sheets_db.ts`, `auth.ts`, etc.
- Closed one-off operation modules (kept for audit history, never imported by app
  code): `hong-luc-migration*.ts`, `btp-shortfall-reprocess.ts`, `cogs5-pipeline-audit.ts`,
  `gate4-mac-drift-classification.ts`, `mac-drift-baseline.ts`, and similar.
- UI/util helpers: `format.ts`, `datetime.ts`, `dialog.ts`, `crypto.ts`.

Target structure (proposal — the point is lifecycle separation, not deep nesting):

```
lib/
  engine/        inventory, COGS, ledger, order transaction core (imported by app/)
  history-ops/   closed one-off correction/migration modules + their tests
  util/          format, datetime, dialog, crypto, client-error-report
  (subdirs that already exist stay: backdated-ledger/, backdated-recipe-events/, __tests__/)
```

Execution constraints: import-path churn across `app/` and `scripts/` is the entire
cost, so (a) phased — one batch per commit, `tsc` + full suite green per batch;
(b) start with `history-ops/` (lowest risk: nothing in `app/` imports those modules —
verify per module with grep before moving, do not trust the classification by name);
(c) `engine/` vs `util/` moves come last and only if the owner still wants them after
seeing the `history-ops/` payoff — moving live engine files has real regression
surface for near-zero runtime benefit. It is legitimate to stop after `history-ops/`.
Implementer: Claude Sonnet 5 (mechanical moves + import rewrites), coordinator review.

**RS-3 (Medium, recurring). `scripts/` regrowth has no enforcement cadence.**
The 2026-07-20 reorganization cut 220 → 133 files; four days later it is back to 186,
because audit gates and data corrections generate scripts by design. The
classification tool (`scripts/generate-script-cleanup-plan.ts`) already exists; what
is missing is the cadence promised in FILE-ORGANIZATION.md ("acted on periodically").
Proposal: make the disposition pass a standing monthly item — regenerate the plan,
archive/delete per classification with owner approval, log to tracking. First run:
next phase close. No new tooling needed.

**RS-4 (High severity relative to cost — the one real defect found). Production
builds skip both type checking and lint.** `next.config.js` sets
`typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. The only
type gate is the Husky pre-commit hook, which is local-only and bypassable
(`--no-verify`, or any commit made from an environment without hooks). A Vercel
deploy of a type-broken tree would currently succeed. Since `tsc --noEmit` is clean
at baseline, flipping `ignoreBuildErrors` to `false` costs nothing today and makes
the deploy itself the enforcement point. Lint is a separate question: run
`next lint` first to measure the backlog; if it is dirty, keep `ignoreDuringBuilds`
until a one-time lint-fix pass lands, then flip it too. Owner note: this config
predates the audit program; it is a leftover, not a decision anyone defends.
Implementer: Codex (config + verification that `next build` still passes).

**RS-5 (Low). Root hygiene items.**
- `check-ts.js`: 9-line wrapper around `npx tsc --noEmit`, referenced by nothing.
  Propose delete (the pre-commit hook and `npx tsc` cover it).
- Untracked local logs `migration-fifo.log`, `migration-fifo-2.log`,
  `migration-live.log`, `migration-live-2.log`, `re-migrate.log`: git-ignored, safe
  to delete locally whenever the owner wants; no repo change involved.

**RS-6 (Low). Dependency placement / dead dependency.**
- `ts-morph` (in `dependencies`): zero imports anywhere in `app/`, `lib/`,
  `components/`, `scripts/`. Propose removal after Codex double-checks (it may have
  been used by a since-deleted one-off script).
- `dotenv` (in `dependencies`): imported only by `scripts/` (153 files). Belongs in
  `devDependencies`; Next.js loads `.env*` natively and never imports it at runtime.
Both fold naturally into DEP-1's ongoing dependency work — same owner (Codex), same
verification bar (`tsc`, suite, build).

**Explicit non-findings (checked, no change proposed):**
- `docs/audits/` and `docs/handoffs/` flat with 100+ files each: intentional
  (immutable, date-prefixed, indexed by ROADMAP/tracking). Moving them breaks
  historical links for zero navigational gain. Keep flat.
- `app/` routing structure: already domain-grouped and consistent; no reorganization
  wanted.
- `supabase/functions/` on-disk bloat (2,384 files) is a local `node_modules` inside
  `backup-to-sheets/`; only 11 files are tracked. Nothing to fix in git.

### Structure work sequencing (all P2 — must not preempt the current queue)

1. RS-4 build-gate flip (Codex, ~1 commit) — highest value per effort, do first.
2. RS-1 + RS-5 + RS-6 hygiene batch (Codex, 1 session, riding on DEP-1).
3. RS-2 `history-ops/` extraction (Sonnet, phased) — after INV-COUNT-1 S2 and PERF-2
   land, to avoid conflicting with Codex's in-flight edits in `lib/`.
4. RS-3 cadence: standing monthly item, first run at next phase close.

---

## Part 2 — Infrastructure direction (language, platform, database)

### The owner's actual question, restated

"Should we keep coding in this language, and keep Vercel, or change?" — evaluated
against where the system is going per the standing 7-phase direction (feature
completeness → UI/UX → multi-outlet → security → franchise-maybe).

### Verdict summary

| Layer | Current | Verdict | Change trigger that would reopen this |
|---|---|---|---|
| Language | TypeScript (strict) | **Keep — not close** | None foreseeable |
| Framework | Next.js 14.2.3 App Router | **Keep, but plan the 14→16 upgrade as its own project** | Already triggered (DEP-1: remaining `next` advisories need next@16) |
| Hosting | Vercel | **Keep** | Sustained cost > ~$50/month, or a hard requirement for offline-capable POS |
| Database | Supabase Postgres | **Keep; upgrade to Supabase Pro before multi-outlet** | Need for point-in-time recovery (already a known gap: F-4 restore drill) |
| Auth | next-auth v4 (credentials + bcrypt vs `Users` table) | **Keep patched for now; decide replacement at the auth overhaul (Future-direction item 6)** | next-auth v4 EOL pressure, or multi-outlet role model outgrowing it |

### Reasoning

**Language — TypeScript stays.** The system's irreplaceable asset is the inventory/
COGS engine (`lib/inventory-consumption.ts`, `lib/full-history-recompute.ts`,
`lib/mac-cogs.ts` and their 721-test safety net) plus 36 migrations of encoded
business rules. A language change means rewriting exactly the code that took months
of audits to make trustworthy, for zero functional gain — every performance issue
found in this audit program was query-shape (full-table loads), never language
speed. Additionally, all three implementing agents work fastest in TypeScript, and
one language across app/scripts/tests keeps the review gates simple. Rewriting into
Go/Python/anything would be the single most destructive decision available.

**Hosting — Vercel stays.** Grounds:
- Scale reality: one shop, ~1,700 orders total, single-digit concurrent users.
  This fits comfortably in Vercel's lowest tiers; there is no capacity argument.
- Zero-ops constraint: no ops staff exists. A VPS (~$10–20/month) is cheaper on
  paper but transfers OS patching, TLS, monitoring, and deploy tooling onto the
  owner — the worst possible trade here. Platform cost is not the binding
  constraint; owner attention is.
- The stack is Vercel-native: App Router, `unstable_cache` tag invalidation,
  `vercel.json` cron (the backdated-corrections job), env management.
- Multi-outlet (ARCH-1) changes the data model, not the platform. Outlets are rows
  and dimensions, not deployments.

Honest limitation to record, not to act on: **no cloud platform gives the POS
offline capability.** If the shop's internet dies, the POS dies, on Vercel or any
alternative. Fixing that requires an offline-first client redesign (local queue +
sync), which is an application project, not a hosting choice — worth revisiting
only if outages actually start costing sales.

**Database — Supabase stays; one paid-tier recommendation.** The atomic-RPC house
pattern, RLS model, advisory-lock conventions, and backup functions are all
Postgres/Supabase-shaped. The one real gap is recovery: the free tier has daily
backups at best and the restore path has never been drilled (finding F-4).
Recommendation: **upgrade Supabase to Pro (~$25/month) before the multi-outlet
phase starts**, for point-in-time recovery — once multiple locations write to the
ledger, "restore to daily backup" means losing a day of multi-outlet sales.
Pair the upgrade with the already-planned restore drill. This is the single
infrastructure spend actually worth making.

**Framework version — the real infrastructure project on the horizon.** Next 14 is
two majors behind; DEP-1 already established that the remaining `next` security
advisories are fixed only in next@16. The upgrade is genuinely engine-adjacent
because `lib/sheets_db.ts`'s caching is built on `unstable_cache`, whose semantics
change across 15/16 (Cache Components / `use cache`). Treat it as its own
owner-approved project (call it **INFRA-UPGRADE-1**): Codex implements, coordinator
reviews, full regression bar (721 tests, P&L/MAC 0-delta audit, live smoke),
scheduled after the current P1 queue (INV-COUNT-1 S2, PERF-2) is clear. React 18→19
and `postcss` ride along. Tailwind 3→4 is explicitly out of scope (pure churn).

**Auth — defer the decision, on purpose.** next-auth v4 is patched (DEP-1 phase 1)
and functional. The auth overhaul is deliberately last in the standing sequence.
When it comes, the two candidates are Auth.js v5 (smallest migration) vs Supabase
Auth (RLS synergy, per-outlet roles fall out naturally). Leaning Supabase Auth *if*
multi-outlet is by then real, but no commitment now — recording the fork so the
ARCH-1 design doc can keep both doors open (its role model should not hard-code
next-auth session shape).

### What this means in money (monthly, at today's scale)

| Item | Now | Recommended end-state |
|---|---|---|
| Vercel | $0 (Hobby) or $20 (Pro) | Unchanged; Pro only if cron/team limits bite |
| Supabase | $0 (Free) | **$25 (Pro) before multi-outlet** — PITR |
| Everything else (GitHub, domain) | ~$0 | Unchanged |

Total steady-state: **~$25–45/month**, no migration cost, no rewrite. The
alternative stacks evaluated (VPS + Docker + Postgres; Cloudflare Workers + D1;
full rewrite in another language) all lose on either owner-ops burden, engine
rewrite risk, or both — none survives the "who maintains this at 2am" test.

---

## Roadmap deltas proposed by this document

- New P2 row **BUILD-GATE-1** (RS-4): flip `ignoreBuildErrors`, measure lint backlog. Codex.
- New P2 row **REPO-STRUCT-2** (RS-1/RS-2/RS-3/RS-5/RS-6): hygiene batch + phased
  `lib/history-ops/` extraction + monthly scripts cadence. Codex (deps/config) +
  Sonnet (moves), owner approves each move list per D8.
- New Future-direction note **INFRA-UPGRADE-1**: Next 14→16 upgrade project,
  after current P1 queue; absorbs the remaining `next` advisories from DEP-1.
- Decision recorded: language/hosting/database stay (TypeScript/Vercel/Supabase);
  Supabase Pro upgrade recommended before multi-outlet phase; auth replacement
  decision deferred to the auth overhaul with both candidates kept open in ARCH-1.
