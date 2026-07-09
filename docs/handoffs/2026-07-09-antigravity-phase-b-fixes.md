# Antigravity Prompt — UI consistency Phase B fixes

Date: 2026-07-09
Owner: Antigravity (UI Lead)
Phase: B (apply fixes after Phase A audit)
Source: `docs/audits/2026-07-06-ui-consistency-audit.md`

## Goal

Apply 4 user-approved fixes from Phase A findings. Each fix is 1 commit (4 commits total). Do NOT touch Loading states (deferred).

## Fix 1: Empty states component (highest impact)

**Goal:** Create reusable `<EmptyState>` component. Replace 15+ ad-hoc patterns.

### Step 1.1: Create component

File: `components/ui/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon?: string;          // emoji or short text
  title: string;          // main message
  description?: string;   // helper text
  action?: {              // optional CTA button
    label: string;
    onClick: () => void;
    href?: string;        // alternative to onClick
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-4 ${className || ""}`}>
      {icon && <div className="text-5xl mb-3 opacity-30" aria-hidden="true">{icon}</div>}
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            {action.label}
          </a>
        ) : (
          <button type="button" onClick={action.onClick} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
```

### Step 1.2: Migrate ad-hoc patterns

Replace these patterns across list pages:

| Page | Old pattern | New |
|---|---|---|
| `/admin/brands` | `py-8` non-italic table row | `<EmptyState>` in `<tbody>` |
| `/admin/units` | `py-8` non-italic table row | `<EmptyState>` |
| `/admin/categories` | `py-8` non-italic table row | `<EmptyState>` |
| `/admin/suppliers` | `py-12 italic` table row | `<EmptyState>` |
| `/admin/inventory/items` | `py-12 italic` table row | `<EmptyState>` |
| `/admin/inventory/conversions` | `py-12 italic` table row | `<EmptyState>` |
| `/admin/inventory/purchase-orders` | `py-12 italic` table row | `<EmptyState>` |
| `/admin/inventory/stock-adjustments` | `py-12 italic` table row | `<EmptyState>` |
| `/admin/inventory/base-ingredients` | `py-12 italic` table row | `<EmptyState>` |
| `/admin/semi-products` | bordered div block | `<EmptyState>` |
| `/admin/activity-log` | bordered div block | `<EmptyState>` |

For each empty state, choose appropriate icon/title/description/CTA:
- Brands: icon "🏢", title "Chưa có thương hiệu", description "Thêm thương hiệu đầu tiên", action "Thêm Thương Hiệu"
- Suppliers: icon "🚚", title "Chưa có nhà cung cấp", action "Thêm Nhà Cung Cấp"
- Purchase Orders: icon "📦", title "Chưa có đơn nhập hàng", action "Tạo Đơn Nhập Hàng"
- (etc.)

### Verify Fix 1

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 308+ tests pass
- Manual: open each list page with no data → consistent empty state

### Commit Fix 1

`Antigravity ui: standardize empty states via <EmptyState> component (X pages)`

---

## Fix 2: Table layout standardization

**Goal:** Unify table header typography + row hover across all admin tables.

### Standard

```tsx
// Table header cells
<th scope="col" className="px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider bg-gray-50">

// Table body cells
<td className="px-4 py-3 text-sm text-gray-700">

// Row hover (on <tr> inside <tbody>)
className="hover:bg-gray-50/50 transition-colors"
```

### Pages to update

| Page | Current → Standard |
|---|---|
| `/admin/brands` | `text-sm font-medium` → `text-[11px] uppercase` |
| `/admin/units` | same | same |
| `/admin/categories` | same | same |
| `/admin/reports/sales` | `py-2` → `px-6 py-4` |
| (any other table not matching standard) | |

### Don't change

- Tables in modals/dropdowns (different context)
- POS product grid (not a table)
- Stock ledger viewer (specialized)

### Verify Fix 2

- Visual check: all list pages have consistent header style
- Hover states consistent

### Commit Fix 2

`Antigravity ui: standardize table header typography + row hover`

---

## Fix 3: Error handling Orders (remove native alert)

**Goal:** Replace native `alert()` calls in Orders with inline alert or toast.

### Files

- `app/admin/orders/OrderTable.tsx`
- `app/admin/orders/OrderEditModal.tsx`
- Any other orders file with `alert(`

### Find

```bash
grep -n "alert(" app/admin/orders/*.tsx
```

### Replace pattern

**Before:**
```tsx
catch (err) {
  alert("Lỗi hủy đơn: " + res.error);
}
```

**After (inline alert):**
```tsx
const [inlineError, setInlineError] = useState<string | null>(null);
// ...
catch (err) {
  setInlineError("Lỗi hủy đơn: " + res.error);
}
// In render:
{inlineError && (
  <div role="alert" aria-live="polite" className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 mb-3">
    {inlineError}
    <button onClick={() => setInlineError(null)} className="ml-2 text-red-500 hover:text-red-700" aria-label="Đóng">×</button>
  </div>
)}
```

OR (toast — use existing POS toast pattern if available; otherwise prefer inline)

### Don't change

- Validation errors (those use inline alerts already via Phase 2 aria-live task)
- Form submission in non-orders contexts

### Verify Fix 3

- Trigger an error in OrderTable (e.g., click "Hủy đơn" → fail) → see inline alert, not browser popup
- Error dismissable

### Commit Fix 3

`Antigravity ui: replace native alert() with inline alert in Orders`

---

## Fix 4: Page headers standardization

**Goal:** Brands, Units, Categories pages use standard header instead of inline flexbox.

### Standard header component

Either reuse `<StickyFilterBar>` (already used elsewhere) or create `<PageHeader>` in `components/ui/PageHeader.tsx`:

```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;  // buttons/links on the right
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

### Pages to update

| Page | Current | New |
|---|---|---|
| `/admin/brands` | inline flexbox | `<PageHeader>` |
| `/admin/inventory/units` | inline flexbox | `<PageHeader>` |
| `/admin/inventory/categories` | inline flexbox | `<PageHeader>` |
| `/admin/products/cogs-estimate` | custom border-b div | `<PageHeader>` |

### Verify Fix 4

- Visual consistency: all admin pages have same header layout
- Mobile: title + action stack on small screens

### Commit Fix 4

`Antigravity ui: standardize page headers via <PageHeader> component`

---

## Workflow

1. Start with **Fix 1** (largest, creates 2 new components used by later fixes)
2. Verify + commit
3. Move to **Fix 2**, verify + commit
4. Move to **Fix 3**, verify + commit
5. Move to **Fix 4**, verify + commit
6. Update `DEVELOPMENT-TRACKING.md` final entry summarizing Phase B

## Out of scope

- Do NOT touch Loading states (deferred to future task)
- Do NOT redesign page layouts (just standardize)
- Do NOT change information architecture
- Do NOT add new dependencies

## Coordination note

Codex is running Task 1 (modifier recipe hardening) in parallel — no file conflicts (Codex touches `app/admin/products/modifiers/actions.ts` + `lib/recipe-selection.ts`; Antigravity touches `components/ui/*` + various `.tsx` page files).
