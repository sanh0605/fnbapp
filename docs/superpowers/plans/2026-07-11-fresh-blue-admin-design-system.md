# Plan: Fresh Blue Admin Design System

Date: 2026-07-11
Owner: Antigravity (UI Lead) — implement; Claude (Coordinator) — review
Timeline: 8-10 days full-time focus
Priority: P0 (paused all other UI work until complete)

## Goal

Apply a consistent "Fresh Blue Admin" theme across all Admin pages without changing business logic, database structure, API behavior, Supabase RLS, user flows, or existing functionality.

Reuse current HTML/CSS/JS architecture (Next.js + Tailwind). Add only Lucide React as new dependency (icon library — not a framework).

## Design tokens (fixed by user — do not change)

### Colors

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#2563EB` | Buttons, links, focus rings, active nav |
| `--color-primary-hover` | `#1D4ED8` | Hover state of primary |
| `--color-primary-active` | `#1E40AF` | Active/pressed state of primary |
| `--color-primary-soft` | `#EFF6FF` | Soft bg for KPI cards, badges |
| `--color-accent-cyan` | `#06B6D4` | Accent highlights (sparingly) |
| `--color-bg-page` | `#F6F8FC` | Page background |
| `--color-surface-card` | `#FFFFFF` | Card/modal surfaces |
| `--color-surface-secondary` | `#F1F5F9` | Secondary surfaces (table headers, code blocks) |
| `--color-sidebar` | `#172033` | Sidebar background (dark) |
| `--color-text-primary` | `#172033` | Body text, headings |
| `--color-text-secondary` | `#64748B` | Labels, captions |
| `--color-text-muted` | `#94A3B8` | Placeholders, disabled text |
| `--color-border` | `#E2E8F0` | Borders, dividers |
| `--color-success` | `#16A34A` | Success states |
| `--color-warning` | `#D97706` | Warning states |
| `--color-danger` | `#DC2626` | Error/destructive states |
| `--color-processing` | `#7C3AED` | Processing/in-progress states |
| `--color-focus-ring` | derived from `#2563EB` | Keyboard focus outlines |

### Other tokens (standardize)

- Card border radius: 12px
- Button border radius: 8px
- Input border radius: 8px
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (Tailwind default scale, keep)
- Font sizes: standardize to Tailwind scale (text-xs/sm/base/lg/xl/2xl)
- Font weights: 400 (body), 500 (medium), 600 (semibold), 700 (bold)
- Shadows: subtle (cards), medium (dropdowns), large (modals)
- Focus ring: `outline: 2px solid var(--color-focus-ring); outline-offset: 2px;`

## Accessibility requirements (WCAG 2.2 AA)

1. **Color contrast**: minimum 4.5:1 for body text, 3:1 for large text
2. **Visible keyboard focus**: focus ring on all interactive elements
3. **Semantic HTML**: use `<button>`, `<nav>`, `<main>`, `<dialog>` correctly
4. **Hover/active/disabled/loading states**: every interactive element has all 4 states
5. **Don't communicate by color alone**: every color-coded status must also have icon or text
6. **Touch targets**: minimum 44×44px (mobile-first rule)

## Files

Antigravity owns: `app/**/*.tsx`, `components/**/*.tsx`, `app/globals.css`, `tailwind.config.*`
Codex unaffected (engine work in `lib/`, `supabase/`, `scripts/` continues independently).
Claude: reviews each phase, updates tracking.

## Phases (sequential, one commit per phase)

### Phase 0: Audit existing styles (Day 1)

**Read-only investigation, no commits.**

- Grep all hardcoded color hex values across `app/` and `components/`
- Identify duplicated colors (e.g., `#1F2937` appearing 50 times)
- List emoji icons used (`🏢`, `📦`, `🚚`, etc.)
- List hardcoded `text-sm`, `text-xs`, `text-[11px]` patterns
- Document inline button styles vs shared components

**Output:** `docs/audits/2026-07-11-design-system-pre-audit.md`

**Commit:** `Antigravity docs: design system pre-audit findings`

**Pause for Claude review** → confirm scope before Phase 1.

---

### Phase 1: Install design tokens (Day 2)

**Files:**
- `app/globals.css` (add `:root { --color-*: ...; }` block with all 17 tokens + radius/spacing)
- `tailwind.config.ts` (extend `colors`, `borderRadius`, `boxShadow` to reference CSS variables)
- `package.json` (add `lucide-react` dependency)

**Tailwind config approach:**
```ts
extend: {
  colors: {
    primary: {
      DEFAULT: 'var(--color-primary)',
      hover: 'var(--color-primary-hover)',
      active: 'var(--color-primary-active)',
      soft: 'var(--color-primary-soft)',
    },
    // ... all tokens
  },
  borderRadius: {
    card: '12px',
    button: '8px',
  }
}
```

This lets developers write `bg-primary`, `text-text-secondary`, `border-border` etc.

**Verification:**
- tsc 0 errors
- vitest 335/335 pass
- No visual change yet (tokens not used)

**Commit:** `Antigravity feat: install design tokens + Lucide React (Phase 1)`

**Pause for Claude review.**

---

### Phase 2: Sidebar redesign to dark theme (Day 3)

The most visible change. Apply dark sidebar (#172033) with clear active navigation highlighting.

**Files:**
- `app/admin/layout.tsx` — sidebar background, text colors, active state
- Replace emoji icons with Lucide equivalents:
  - `📊` → `<LayoutDashboard />`
  - `📦` → `<Package />`
  - `🚚` → `<Truck />`
  - `🥣` → `<CookingPot />`
  - `☕` → `<Coffee />`
  - `🧾` → `<Receipt />`
  - `📈` → `<TrendingUp />`
  - `⚙️` → `<Settings />`

Active nav: primary color background, white text.
Inactive nav: gray text, hover lightens background.

**Verification:**
- Manual: click each nav item, verify active state
- Mobile drawer still works (drawer inherits dark theme)
- tsc + vitest clean

**Commit:** `Antigravity feat: dark sidebar with Lucide icons (Phase 2)`

**Pause for Claude review.**

---

### Phase 3: Shared components refactor (Days 4-5)

Apply tokens to all shared components in `components/ui/`:

| Component | Changes |
|---|---|
| `Button.tsx` | **NEW** — variants: primary/secondary/ghost/danger; sizes: sm/md/lg; states: hover/active/disabled/loading |
| `PageHeader.tsx` | Use token colors |
| `EmptyState.tsx` | Use token colors, optional Lucide icon prop |
| `Skeleton.tsx` | Use `--color-surface-secondary` |
| `SkeletonTable.tsx` | Same |
| `FormModal.tsx` | Use Button component + tokens |
| `DeleteConfirmModal.tsx` | Use Button (danger variant) + tokens |
| `Alert.tsx` | **NEW** — variants: success/warning/danger/info; with Lucide icon + text (not color alone) |
| `Badge.tsx` | **NEW** — variants: success/warning/danger/processing/neutral |
| `Card.tsx` | **NEW** — 12px radius, subtle border, white bg |

**Existing forms must use Button**: search for inline `bg-blue-600` / `bg-orange-600` patterns, replace with `<Button variant="primary">`.

**Verification:**
- tsc + vitest clean
- Spot-check 3 forms to confirm Button works

**Commit:** `Antigravity feat: shared component library with design tokens (Phase 3)`

**Pause for Claude review.**

---

### Phase 4: Migrate high-impact pages (Days 6-7)

Apply tokens + shared components to most-used pages first:

| Priority | Page | Why |
|---|---|---|
| 1 | `/admin/products` (incl. ProductForm) | Most used form, currently orange |
| 2 | `/admin/orders` | Most used list page |
| 3 | `/admin` (Dashboard) | First impression |
| 4 | `/admin/reports/sales`, `/pnl`, `/stock` | Reports |
| 5 | `/admin/inventory/items` | Catalog hub |

For each page:
- Replace hardcoded `bg-blue-600` etc. with `bg-primary`
- Replace `text-red-*` with `text-danger` (rose/red variants consolidated to danger)
- Replace inline button className with `<Button>` component
- Replace emoji icons with Lucide
- Replace custom alert()/empty state with shared components
- Verify all 4 states (hover/active/disabled/loading)
- Verify WCAG contrast at https://webaim.org/resources/contrastchecker/

**Commits:** one per page (5 commits). Each commit pause for Claude review.

**Commit prefix:** `Antigravity feat: apply Fresh Blue theme to <page> (Phase 4.<n>)`

---

### Phase 5: Migrate remaining pages (Days 8-9)

Same pattern as Phase 4 but for remaining pages:

- `/admin/brands`, `/admin/suppliers`
- `/admin/inventory/categories`, `/base-ingredients`, `/conversions`, `/units`, `/sync`
- `/admin/inventory/purchase-orders`, `/stock-adjustments`
- `/admin/audit/backdated-ledger`
- `/admin/semi-products`, `/admin/production`
- `/admin/products/categories`, `/toppings`, `/cogs-estimate` (skip `/modifiers` if Codex active there)
- `/admin/promotions`
- `/admin/users`, `/admin/activity-log`, `/admin/backup`, `/admin/clear-cache`

**Commits:** batch by sidebar group (5-6 commits total). Each pause for review.

**Commit prefix:** `Antigravity feat: apply Fresh Blue theme to <group> (Phase 5.<n>)`

---

### Phase 6: QA + final report (Day 10)

**Verification checklist:**

For each admin page:
- [ ] Mobile (375px) renders correctly
- [ ] Tablet (768px) renders correctly
- [ ] Desktop (1280px+) renders correctly
- [ ] All buttons have hover/active/disabled/loading states
- [ ] All forms have error/success states with icon + text (not color alone)
- [ ] Keyboard navigation works (Tab, Enter, Escape on modals)
- [ ] No console errors
- [ ] No functionality changed vs pre-design-system

**Git diff audit:**
- Verify only UI files changed (`app/`, `components/`, `globals.css`, `tailwind.config.ts`)
- Verify NO changes to `lib/`, `supabase/`, `scripts/`, server actions logic
- Verify NO schema/migration changes

**Functional regression:**
- Run vitest 335+/335+ pass
- Run tsc 0 errors
- Manual: 5 key user flows (login, create order, add product, view report, adjust inventory)

**Final report:** `docs/audits/2026-07-XX-fresh-blue-admin-final-report.md`
- Files changed (count + categories)
- Visual improvements completed
- Tests performed
- Remaining inconsistencies (if any)
- Regression risks

**Commit:** `Antigravity docs: Fresh Blue Admin final report (Phase 6)`

## Coordination

- **Antigravity**: full-time on this plan, Phases 0-6
- **Codex**: continues engine work (E2 Task 3.3, etc.) independently — no file conflicts since Codex touches `lib/`, `supabase/`, `scripts/`
- **Claude**: reviews each phase commit, updates ROADMAP, updates COMPLETED.md when done
- **User**: approves color/icon/style decisions (already done in this prompt), available for questions

## Out of scope (do NOT do)

- Do NOT change business logic in any `actions.ts` file (only UI layer)
- Do NOT change database schema (no new migrations)
- Do NOT change API contracts (no new RPC, no changes to existing RPC signatures)
- Do NOT change Supabase RLS policies
- Do NOT change authentication / session flow
- Do NOT change user flows (navigation order, page transitions)
- Do NOT introduce new framework (no shadcn/ui CLI install, no Radix, no HeadlessUI) — Lucide React is the only new dep allowed
- Do NOT touch brand colors on `/pos` customer-facing screens (brand colors are for logos only per user spec)
- Do NOT change Codex-owned files (`lib/*.ts`, `supabase/*`, `scripts/*`)

## Risk mitigation

| Risk | Mitigation |
|---|---|
| Color contrast fails WCAG | Use WebAIM contrast checker before committing each page |
| Functional regression | Phase 6 explicit regression test |
| Scope creep into business logic | Phase 6 git diff audit catches non-UI changes |
| Token misuse (hardcoded colors remain) | Phase 0 audit lists all hardcoded values; Phase 4-5 verify removal |
| Sidebar dark theme breaks mobile drawer | Phase 2 manual test on mobile viewport |
| Antigravity `git add -A` again | Surgical commit rule explicit per phase; each phase lists exact files |

## Success criteria

1. All admin pages use only design tokens (no hardcoded hex values)
2. All buttons use `<Button>` component (no inline button className)
3. All status indicators have icon + text (not color alone)
4. WCAG 2.2 AA contrast verified
5. Mobile/tablet/desktop verified
6. Zero functional regressions
7. Final report published

## Change log

- 2026-07-11 Claude: created plan based on user's "Fresh Blue Admin" spec
