# Antigravity Prompt — Backdated Ledger Admin Review UI (Task 3.2 Phase C)

Date: 2026-07-10
Owner: Antigravity (UI Lead)
Trigger: Codex Phase B complete (commit `2d86c45`). Engine interfaces stabilized. UI now has concrete types + functions + RPC to call.

## Background

Codex implemented Task 3.2 engine pipeline:
- Phase A (commit `c561e43`): schema + trigger for backdated ledger detection
- Phase B (commit `2d86c45`): RPC lifecycle + TS recompute pipeline

Now Phase C: admin review UI. Codex runs Phase D (engine tests) in parallel.

**Business context** (from user interview):
- Backdating frequency: weekly (operator too busy)
- Policy: Allow + flag manual review
- Materiality: Zero tolerance — drift must resolve to 0 after admin approves recompute

Workflow UI must support:
1. Operator enters backdated PO → trigger creates PENDING event
2. Admin opens review page → sees list of pending events
3. Admin clicks event → detail page shows affected order lines + delta VND
4. Admin approves → atomic recompute → drift = 0
5. Admin can also reject (e.g., legitimate correction, no recompute needed)

## Scope

**UI only.** No engine changes. No migrations. No new RPC.

Files to create are listed per component below.

## Engine interfaces (do NOT modify, just call)

### TypeScript imports

From `lib/backdated-ledger/recompute-event.ts`:

```ts
import {
  recomputeEventDryRun,
  recomputeEventApply,
  type BackdatedEventRecoveryPlan,
  type BackdatedEventRecoveryApplyResult,
} from "@/lib/backdated-ledger/recompute-event";
```

From `lib/backdated-ledger/find-affected-lines.ts`:

```ts
import type { AffectedOrderLine } from "@/lib/backdated-ledger/find-affected-lines";
```

### Supabase RPC calls (direct)

For non-recompute actions, call RPCs directly via `lib/supabase.ts`:

```ts
// Reject event (no recompute)
await supabase.rpc("reject_backdated_event", {
  p_event_id: eventId,
  p_reviewer: reviewerName,
  p_reason: rejectionReason,
});

// Fetch events list
await supabase
  .from("backdated_ledger_events")
  .select("*")
  .order("detected_at", { ascending: false });
```

### DB schema (read-only view)

Table `public.backdated_ledger_events`:

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| stock_ledger_id | text | references stock_ledger row |
| detected_at | timestamptz | when trigger fired |
| effective_timestamp | timestamptz | backdated effective time |
| visibility_timestamp | timestamptz | real insert time |
| source_table | text | e.g., `purchase_orders` |
| source_id | text | e.g., `PO-051` |
| item_reference | text | e.g., `NNL-007` |
| quantity_change | numeric | units added |
| unit_cost | bigint | VND per unit |
| status | text | PENDING, APPROVED, RECOMPUTED, REJECTED |
| reviewed_by | text | admin name |
| reviewed_at | timestamptz | when reviewed |
| recompute_run_id | text | run id if recomputed |
| notes | text | rejection reason or notes |

## Files to create

### Pages

| File | Purpose |
|---|---|
| `app/admin/audit/backdated-ledger/page.tsx` | List page with filters + pagination |
| `app/admin/audit/backdated-ledger/[eventId]/page.tsx` | Detail page with affected lines + actions |
| `app/admin/audit/backdated-ledger/loading.tsx` | Loading skeleton |
| `app/admin/audit/backdated-ledger/actions.ts` | Server actions (approve/reject) |

### Components

| File | Purpose |
|---|---|
| `components/backdated-ledger/event-row.tsx` | List row (one event per row) |
| `components/backdated-ledger/event-detail.tsx` | Detail view (metadata + affected lines table) |
| `components/backdated-ledger/status-badge.tsx` | Status pill (PENDING/APPROVED/RECOMPUTED/REJECTED) |
| `components/backdated-ledger/affected-lines-table.tsx` | Table of affected order lines with old/new/delta |
| `components/backdated-ledger/reject-modal.tsx` | Confirmation modal for reject action (requires reason) |
| `components/backdated-ledger/apply-modal.tsx` | Confirmation modal for apply action (shows delta summary) |

### Reuse existing components

- `components/ui/PageHeader.tsx` — page header (consistent with other admin pages)
- `components/ui/EmptyState.tsx` — empty list state
- `components/ui/SkeletonTable.tsx` — loading state
- `lib/datetime.ts:formatDateTime` — Vietnam time display
- `lib/format.ts:formatNumber` — VND formatting (no currency suffix)
- `lib/supabase.ts` — server client

Reference existing patterns from:
- `app/admin/orders/page.tsx` — list page pattern
- `app/admin/orders/[id]/page.tsx` — detail page pattern
- `app/admin/products/page.tsx` — filter bar pattern

## List page spec

Route: `/admin/audit/backdated-ledger`

### Features

1. **PageHeader**: "Backdated Ledger Review" + description "Các giao dịch nhập kho được backdate cần admin duyệt"

2. **Filter bar** (sticky top, similar to StickyFilterBar):
   - Status filter: PENDING (default selected), APPROVED, RECOMPUTED, REJECTED, ALL
   - Date range picker (detected_at)
   - Item reference text input
   - Source table dropdown: ALL, purchase_orders, stock_adjustments, production_yields

3. **Table** with columns:
   - `detected_at` (Vietnam time)
   - `source_table` + `source_id` (e.g., "purchase_orders / PO-051")
   - `item_reference`
   - `quantity_change` (signed, with sign indicator)
   - `unit_cost` (VND formatted)
   - `effective_timestamp` → `visibility_timestamp` (lag duration, e.g., "2 days 3 hours")
   - `status` (StatusBadge)
   - Actions: View detail (link icon)

4. **Row click** navigates to detail page

5. **Pagination**: 50 per page, show "X-Y of Z" count

6. **Empty state**: EmptyState component with message "Không có giao dịch backdate cần duyệt"

### Query (server-side)

```ts
const { data: events } = await supabase
  .from("backdated_ledger_events")
  .select("*")
  .order("detected_at", { ascending: false })
  .range((page - 1) * 50, page * 50 - 1);
```

Apply filters via URL search params (use `lib/use-url-state.ts` pattern from existing admin pages).

## Detail page spec

Route: `/admin/audit/backdated-ledger/[eventId]`

### Features

1. **Back link** to list page

2. **Event metadata card**:
   - Status badge (large)
   - Detected at
   - Effective → Visibility timestamps with lag
   - Source: `purchase_orders / PO-051` (link to PO detail if available)
   - Item: `NNL-007` (link to product detail if applicable)
   - Quantity change: `+60` (with arrow icon)
   - Unit cost: `2.400`
   - Stock ledger ID: link to stock ledger view if available
   - If reviewed: reviewer name + reviewed_at + notes

3. **Affected lines section** (via `recomputeEventDryRun(eventId)`):
   - Section title: "Order lines bị ảnh hưởng"
   - Table columns:
     - Order # (link to `/admin/orders/[orderId]`)
     - Sale time (Vietnam)
     - Product ID
     - Qty
     - Stored COGS
     - New COGS (after recompute)
     - Delta VND (green if positive, red if negative)
   - Footer: Total delta VND
   - Empty: "Không có order line nào bị ảnh hưởng" (likely means item is in inventory but not used in any sold product recipe)

4. **Action buttons** (only if status is PENDING):
   - "Duyệt + Tính lại COGS" (primary button, opens ApplyModal)
   - "Từ chối" (secondary button, opens RejectModal)

5. **Recompute result display** (if status is RECOMPUTED):
   - "Đã tính lại: X order lines, total delta Y VND"
   - Run ID with link to data_recovery_changes view (if available)
   - Reviewer + reviewed_at

6. **Reject result display** (if status is REJECTED):
   - "Đã từ chối: <reason>"
   - Reviewer + reviewed_at

### Server action (in `actions.ts`)

```ts
"use server";

import { recomputeEventApply } from "@/lib/backdated-ledger/recompute-event";
import { getSupabaseClient } from "@/lib/supabase";

export async function approveAndRecomputeAction(eventId: string, reviewer: string) {
  try {
    const result = await recomputeEventApply(eventId, reviewer);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function rejectEventAction(eventId: string, reviewer: string, reason: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("reject_backdated_event", {
    p_event_id: eventId,
    p_reviewer: reviewer,
    p_reason: reason,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
```

Reviewer name source: get from session/cookie (check existing pattern in other admin actions). If no auth, use placeholder "admin" — note for future.

## Components spec

### StatusBadge

```tsx
const STATUS_CONFIG = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Đã duyệt", className: "bg-blue-50 text-blue-700 border-blue-200" },
  RECOMPUTED: { label: "Đã tính lại", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Đã từ chối", className: "bg-gray-50 text-gray-700 border-gray-200" },
};
```

Border + dot indicator style. Consistent with existing badge patterns in admin.

### ApplyModal

Props: `eventId`, `affectedLineCount`, `totalDeltaVnd`, `onConfirm`, `onCancel`

Content:
- Title: "Xác nhận tính lại COGS"
- Body: "Hành động này sẽ cập nhật COGS cho {{affectedLineCount}} order lines, tổng chênh lệch {{totalDeltaVnd}} VND. Không thể hoàn tác."
- Reviewer input (text)
- Buttons: "Hủy" (secondary), "Xác nhận" (primary destructive-style)
- On confirm: calls `approveAndRecomputeAction`, shows loading spinner, navigates to detail page with updated status on success

### RejectModal

Props: `eventId`, `onConfirm`, `onCancel`

Content:
- Title: "Từ chối tính lại"
- Body: "Đánh dấu giao dịch này là không cần tính lại. Lý do:"
- Reason textarea (required, min 10 chars)
- Reviewer input (text)
- Buttons: "Hủy" (secondary), "Từ chối" (primary)
- On confirm: calls `rejectEventAction`

### AffectedLinesTable

Props: `lines: AffectedOrderLine[]`, `changes: BackdatedEventRecoveryChange[]`

Display table per spec above. Use semantic colors for delta (emerald for positive, rose for negative).

## Loading states

- `loading.tsx`: SkeletonTable (matches existing pattern)
- Detail page loading: skeleton of metadata card + table
- Action button loading: spinner inside button, disable button

## Empty states

- List page (no events): EmptyState with "Không có giao dịch backdate cần duyệt"
- Detail page (no affected lines): inline note "Không có order line nào bị ảnh hưởng — giao dịch này có thể là nhập kho cho item chưa được bán trong cửa sổ thời gian"

## Error states

- RPC error: inline alert (rose color) with error message
- Event not found: redirect to list page with toast "Sự kiện không tồn tại"
- Network error: retry button

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 320+/320+ pass (no UI tests required this phase)
- Manual via Playwright:
  1. Navigate to `/admin/audit/backdated-ledger` → list loads, empty state shows (no PENDING events yet, since migration 0014/0015 not deployed)
  2. Click any event ID in URL → 404 handling OK
  3. Filter UI works (clicking filter changes URL params)
- Lighthouse-friendly: no console errors, keyboard accessible

## Commit

Single commit:
```
Antigravity feat: admin backdated ledger review UI (Task 3.2 Phase C)
```

Commit body:
- Page structure overview
- Reuse of shared components
- Action safety (confirmation modal pattern)
- Reviewer name source (session/placeholder)

## Out of scope (do NOT do)

- Do NOT modify any `lib/backdated-ledger/*` files (Codex engine)
- Do NOT modify migrations 0014 or 0015
- Do NOT deploy migrations (Claude deploys)
- Do NOT add new RPC (call existing ones only)
- Do NOT change `lib/datetime.ts` or `lib/format.ts` (use as-is)
- Do NOT implement auth (placeholder "admin" is fine for now, note for future)
- Do NOT touch unrelated dirty files in working tree

## Coordination

- Codex Phase D (engine tests) runs in parallel — do not conflict with `lib/backdated-ledger/*` files
- After Phase C + D done, Claude reviews both, then deploys migrations 0014 + 0015 via `supabase db push`
- First real PENDING event expected within a week per user interview (weekly backdating frequency)
- Claude will manually walk through UI with first real event, verify drift = 0 after approve

## If blocker encountered

If any of these blockers occur, pause and ask Claude:
- Existing admin page pattern unclear (which page to mirror?)
- Reviewer name source ambiguous (auth not set up?)
- Affected line display requires data not in plan (e.g., product name)
- URL state pattern unclear (which existing page uses `use-url-state.ts`?)

Document blocker in commit body with `WIP - blocked:` prefix, pause for direction.
