# Antigravity Prompt — URL state sync scale (Stock, Items, Promotions)

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Priority: 4 (per roadmap)
Estimated effort: ~2 hours

## Goal

Apply the validated URL state sync pattern (from `/admin/orders` pilot) to 3 more filter-heavy pages:
- `/admin/inventory/items` (Hàng Mua Vào)
- `/admin/inventory/stock-adjustments` (Điều chỉnh Tồn kho)
- `/admin/promotions` (Khuyến mãi)

After this change, users can share/bookmark filtered views on these pages too.

## Reference pattern

`/admin/orders` is the validated pilot. Key files:
- `app/admin/orders/OrderTable.tsx` — uses `useSearchParams` + `useRouter`
- `app/admin/orders/page.tsx` — wraps in `<Suspense>` boundary

Reference the actual implementation in those files. Mirror the pattern.

## Files to migrate

### 1. `app/admin/inventory/items/components/ItemsClient.tsx`

Current state (line 19-20):
```tsx
const [search, setSearch] = useState("");
const [categoryFilter, setCategoryFilter] = useState("ALL");
```

URL params to use:
- `?q=<search>` — search keyword
- `?category=<category_id|ALL>` — category filter

Pattern:
```tsx
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const searchParams = useSearchParams();
const router = useRouter();
const pathname = usePathname();

const [search, setSearch] = useState(searchParams.get("q") || "");
const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "ALL");

// Update URL when filters change
useEffect(() => {
  const params = new URLSearchParams(searchParams.toString());
  if (search) params.set("q", search); else params.delete("q");
  if (categoryFilter && categoryFilter !== "ALL") params.set("category", categoryFilter); else params.delete("category");
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}, [search, categoryFilter]);

// Sync from external URL changes (back/forward)
useEffect(() => {
  setSearch(searchParams.get("q") || "");
  setCategoryFilter(searchParams.get("category") || "ALL");
}, [searchParams]);
```

### 2. `app/admin/inventory/stock-adjustments/components/StockAdjustmentsClient.tsx`

Current state (line 32):
```tsx
const [searchQuery, setSearchQuery] = useState("");
```

Also has `statusFilter` (from earlier grep showing `statusFilter === tab` logic).

URL params:
- `?q=<search>`
- `?status=<PENDING|APPROVED|REJECTED|ALL>`

Same pattern as above.

### 3. `app/admin/promotions/components/PromotionsClient.tsx`

Current state (line 28-30):
```tsx
const [statusFilter, setStatusFilter] = useState("ALL");
const [typeFilter, setTypeFilter] = useState("ALL");
const [searchTerm, setSearchTerm] = useState("");
```

URL params:
- `?q=<search>`
- `?status=<ACTIVE|EXPIRED|SCHEDULED|ALL>`
- `?type=<PERCENT|VND|ALL>`

Same pattern.

## Page-level changes

For each of the 3 pages, wrap the client component in `<Suspense>` if not already done:

```tsx
// app/admin/inventory/items/page.tsx (and similar)
import { Suspense } from "react";

export default async function Page() {
  // ... existing data fetch ...
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ItemsClient items={...} categories={...} />
    </Suspense>
  );
}
```

This is required by Next.js 14 when client components use `useSearchParams`.

## Helper extraction (optional, recommended)

If the pattern repeats 3+ times, extract to `lib/use-url-state.ts`:

```tsx
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [value, setValue] = useState<T>(
    (searchParams.get(key) as T) || defaultValue
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== defaultValue) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [value]);

  useEffect(() => {
    setValue((searchParams.get(key) as T) || defaultValue);
  }, [searchParams]);

  return [value, setValue];
}
```

If extracted, the call sites become:
```tsx
const [search, setSearch] = useUrlState("q", "");
const [categoryFilter, setCategoryFilter] = useUrlState("category", "ALL");
```

Decision: extract if 3+ pages use it. Otherwise inline.

## Verification

For each of 3 pages:

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual check (Playwright or browser):
   - Navigate to page
   - Type in search → URL updates `?q=...`
   - Click filter → URL updates
   - Refresh → filters persist
   - Copy URL to new tab → same filtered view
   - Browser back → previous filter state
   - All filters at default → URL is clean (no params)

## Commit strategy

3 commits (1 per page) for clean history + easy rollback:

1. `Antigravity feat: URL state sync for /admin/inventory/items`
2. `Antigravity feat: URL state sync for /admin/inventory/stock-adjustments`
3. `Antigravity feat: URL state sync for /admin/promotions`

Plus optional 4th commit if helper extracted:
4. `Antigravity refactor: extract useUrlState helper to lib/use-url-state.ts`

## Out of scope

- Do NOT add nuqs dependency (keep using built-in Next.js)
- Do NOT change filter logic itself (just storage location)
- Do NOT touch other state (modals, selections)
- Do NOT migrate pages not in the list above (Reports pages already use server-side URL sync correctly)

## Coordination note

This task uses the same pattern as `/admin/orders`. If anything is unclear, read `app/admin/orders/OrderTable.tsx` for the validated implementation.
