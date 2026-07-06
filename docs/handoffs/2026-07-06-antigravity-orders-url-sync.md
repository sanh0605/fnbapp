# Antigravity Prompt — URL state sync pilot (/admin/orders filters)

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Trigger: UI Phase D pilot. /admin/orders has 6 filter widgets in local `useState` — not shareable, not bookmarkable, lost on refresh.

## Goal

Migrate `/admin/orders` filter state from local `useState` to URL query params. After this change:
- User filters orders → URL updates (e.g. `?status=COMPLETED&payment=CASH&page=2`)
- User refresh / share URL → filters restored
- Browser back/forward works for filter changes

This is a **pilot** to validate the pattern before applying to other pages (Reports, Stock, etc.).

## Files

- `app/admin/orders/OrderTable.tsx` (primary — 6 useState to migrate)
- `app/admin/orders/page.tsx` (may need `searchParams` prop or Suspense wrapper if using server-side reading)

## Current state

`OrderTable.tsx` line 56-62:

```tsx
const [currentPage, setCurrentPage] = useState(1);
const [searchQuery, setSearchQuery] = useState("");
const [startDate, setStartDate] = useState<Date | null>(null);
const [endDate, setEndDate] = useState<Date | null>(null);
const [paymentFilter, setPaymentFilter] = useState("");
const [brandFilter, setBrandFilter] = useState("");
```

All 6 are user-driven filter state — perfect candidates for URL sync.

State NOT to migrate (keep as local):
- `orders`, `setOrders` (data)
- `orderToVoid`, `voidReason` (transient modal state)
- `selectedOrder`, `editingOrder` (transient modal state)

## Approach options

### Option A: Next.js `useSearchParams` + `useRouter` (recommended)

No new dependencies. Built into Next.js 14 App Router.

```tsx
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function useUrlState<T>(key: string, defaultValue: T) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = (() => {
    const raw = searchParams.get(key);
    if (raw === null) return defaultValue;
    // type coercion based on T
    return raw as T;
  })();

  const setValue = (next: T | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null || next === "" || next === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, String(next));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return [value, setValue] as const;
}
```

Then:
```tsx
const [searchQuery, setSearchQuery] = useUrlState("q", "");
const [paymentFilter, setPaymentFilter] = useUrlState("payment", "");
const [brandFilter, setBrandFilter] = useUrlState("brand", "");
const [currentPage, setCurrentPage] = useUrlState("page", 1);
// Dates need special handling — see below
```

**Date handling**: Dates don't fit cleanly in URL. Use ISO date strings:
```tsx
const [startDateStr, setStartDateStr] = useUrlState("from", "");
const startDate = startDateStr ? new Date(startDateStr) : null;
```

### Option B: `nuqs` library (defer — adds dependency)

Powerful, handles arrays/numbers/dates natively. But adds dependency. If Option A works for this pilot, decide later if nuqs is worth it for other pages.

## Important constraints

1. **`useSearchParams` requires Suspense boundary** in Next.js 14 App Router when used in a client component that's rendered by a server component. Verify whether `OrderTable.tsx` needs to be wrapped in `<Suspense>` from `page.tsx`. If yes, add minimal Suspense fallback.

2. **Don't break existing URL params**: check if `/admin/orders` already uses any query params (e.g. `?order=<id>` for deep linking). Preserve those.

3. **Pagination resets**: when user changes a filter, reset `page` to 1. Don't keep stale page param.

4. **Date range**: format as `YYYY-MM-DD` in URL (compact, readable). Internally convert to Date objects.

5. **Default values**: omit from URL when at default (cleaner URLs). E.g. empty `q=` is noisy, omit.

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual check:
   - Open `/admin/orders`
   - Type in search → URL updates `?q=...` live
   - Click payment filter → `?payment=CASH`
   - Refresh page → filters persist
   - Copy URL to new tab → same filtered view
   - Browser back → previous filter state
   - All filters at default → URL is clean (no `?` params)
4. Edge cases:
   - Empty search query → `q` removed from URL
   - Page 1 → `page` not in URL
   - Date range cleared → both `from` and `to` removed

## Commit

Suggested: `Antigravity feat: URL state sync for /admin/orders filters (pilot)`

## Out of scope

- Do NOT migrate other pages (Reports, Stock) — separate work after pilot validated
- Do NOT add nuqs dependency yet
- Do NOT change filter logic itself (just storage location)
- Do NOT touch order detail modal state

## Follow-up (next session)

After this pilot validates:
- Apply same pattern to `/admin/reports/sales`, `/admin/reports/pnl`, `/admin/inventory/items` etc.
- Consider extracting `useUrlState` helper to `lib/use-url-state.ts` for reuse
