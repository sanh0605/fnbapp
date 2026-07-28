# Multi-Outlet Design (ARCH-1)

Date: 2026-07-28
Status: approved by owner, ready for implementation planning

## Context

Today the system models exactly one physical location per brand — there is
no concept of "outlet" at all, only `brand_id`. The owner is planning to
open more physical locations, including locations that share one physical
spot but sell different brands at different times of day (e.g. "Phin Đi"
in the morning, "Uchako" in the evening, same address). The existing
`?brandId=` URL parameter on POS, and the implicit "1 brand = 1 place"
assumption throughout inventory/reporting, cannot express this.

Per the project's roadmap, this is a **design-only** phase. Implementation
is explicitly sequenced after the UI/UX phase, which has not started.
Nothing in this document is to be built yet.

## Goal

Introduce a physical-location concept ("outlet") that is independent of
brand, a time-based mechanism for which brand an outlet sells at any given
moment, and a staff-assignment mechanism that follows the same time-based
logic — while keeping today's single-outlet-per-brand reality working
as a special case (1 outlet, 1 all-day slot) requiring no operational
change for outlets that never share space with another brand.

## Non-goals (explicit, owner-confirmed)

- **Per-outlet inventory.** Stock stays tracked per brand, shared across
  all outlets selling that brand, exactly as today. No stock transfer
  between outlets, no per-outlet stock ledger.
- **Per-outlet reporting.** Reports stay aggregated by brand for now.
  `outlet_id` is captured on every order so outlet-level reporting is
  possible later, but no outlet report is built in this phase.
- **Full shift-scheduling / calendar system.** No rostering UI, no
  recurring weekly patterns beyond a fixed daily time window per slot. The
  only "schedule" concept is the flat list of assignment tickets described
  below.
- **Overnight-spanning time windows.** No outlet in the business sells
  across midnight; every slot's start/end time fits within a single day.
- **Offline outlet resolution changes.** This design does not alter the
  POS offline-resilience behavior already shipped — outlet/brand
  resolution happens at login, which requires connectivity same as today.

## Core Model

### Outlet

A physical location, independent of brand. Identified by a unique name
(the system rejects creating a second outlet with a name already in use,
to prevent accidental duplicates). Has an address. Does not reference any
brand directly.

### Outlet_Brand_Slot ("selling slot")

Defines which brand an outlet sells, and during which daily time window.
Fields (conceptual, not final DDL): `outlet_id`, `brand_id`,
`start_time`, `end_time` (time-of-day, recurring every day — not tied to a
specific calendar date).

- An outlet that only ever sells one brand gets exactly one slot,
  `00:00`–`24:00`.
- An outlet that sells two brands at different times of day gets two (or
  more) slots, one per brand/time-window.
- **Overlapping slots at the same outlet are allowed, not blocked.** If a
  data-entry mistake (or a genuine business need, e.g. two brands sharing
  a counter at the same hour) creates overlapping windows, the system does
  not reject it. See "Login Resolution" below for how this is handled at
  the point someone actually logs in during an overlap.

### Staff_Slot_Assignment ("ticket")

Assigns one staff member to one selling slot, for a range of dates.
Fields (conceptual): `staff_id`, `outlet_brand_slot_id`, `start_date`,
`end_date` (nullable).

- `end_date = null` means the assignment is open-ended (the common case:
  a staff member's standing assignment to their usual slot).
- `end_date` set means the assignment stops applying after that date. This
  is used both for planned temporary coverage (a fill-in shift with a
  known end date, set at creation time) and for closing out a
  no-longer-current assignment (e.g. as the first half of a transfer,
  described below).
- **A staff member can hold multiple concurrent tickets** — e.g. a
  standing morning ticket at Outlet 1 and a standing evening ticket at
  Outlet 3, because those really are two different jobs at two different
  physical locations on the same day. This is normal, not an edge case.
- There is no separate "permanent" vs "temporary" ticket type in the data
  model — both are the same record shape. "Permanent" is simply a ticket
  whose `end_date` happens to be unset.

### Manager assignment (separate from tickets)

A manager who oversees multiple outlets is not assigned via
Staff_Slot_Assignment tickets at all. Instead, a manager account is linked
to the set of outlets they oversee via a simple link (conceptual:
`manager_id`, `outlet_id` pairs, many-to-many), and — because a manager
sometimes needs to sell directly at any of those outlets — is given a
**manual** outlet + brand picker on POS instead of automatic slot
resolution (see below).

## Operational Flow

### Regular staff login

1. Staff logs in (authentication unchanged from today).
2. The system reads the staff member's tickets and finds every one where
   today's date falls within `[start_date, end_date or infinity]` **and**
   the current time falls within the ticket's slot's `[start_time,
   end_time]`.
3. **Exactly one match:** the system enters that ticket's outlet + brand
   automatically. No manual selection, no visible outlet-switching UI for
   ordinary staff.
4. **Multiple matches** (the staff member has overlapping tickets valid
   right now — e.g. a data-entry overlap, or an active transfer with the
   old ticket accidentally still open): the staff member is asked to pick
   which one applies. This is the one point where a normal staff member
   sees an outlet choice at all.
5. **Zero matches:** authentication still succeeds (the staff member is a
   valid account), but the system shows no outlet to sell from and blocks
   checkout with "Chưa được phân ca giờ này." This is the same framing as
   the owner's confirmed edge case for the earlier "no matching outlet"
   scenario: login is not blocked, selling is.

### Manager login

A manager selects outlet + brand manually from the list of outlets they
oversee. This selection is not constrained by tickets or time windows —
a manager can sell at any outlet on their list, any time, to cover for
staff when needed.

### `?brandId=` URL parameter

The parameter continues to exist internally (POS still needs to know
"which brand's menu/prices to render"), but its value is no longer
user-suppliable. It is set by the system after outlet/brand resolution
(steps above), not read from a query string a user can edit — this closes
off using the URL to reach a brand/outlet the account is not authorized
for.

### Orders capture outlet at time of sale

`Orders_V2` gains an `outlet_id` column, set once at the moment the order
is created and never revisited afterward. A later transfer, ticket edit,
or ticket deletion never changes the outlet already recorded on a
historical order — this mirrors the existing `created_at`/`synced_at`
split's principle that sale-time facts are immutable once recorded.

## Managing Tickets

All ticket operations happen from a staff member's own profile page,
which lists that staff member's currently-active tickets as separate
rows (not a global flat list of every ticket ever created — a flat list
becomes unusable as headcount grows). Every ticket is directly editable
at any time; there is no separate "cancel" vs "restore" mechanism.

- **Create a new ticket:** pick staff + slot + start date (+ optional end
  date for planned temporary coverage).
- **Transfer:** click the specific ticket line to change (not a
  staff-wide action, since a staff member may have several concurrent
  tickets — e.g. changing only the morning one while an evening temporary
  ticket continues untouched). Pick the new slot and the effective date.
  The system automatically sets the old ticket's `end_date` to the day
  before the new one's `start_date`, and creates the new ticket in one
  step.
- **Fix a mistake:** edit the ticket's fields directly (staff, slot,
  dates), or delete it outright if it should never have existed. If a
  transfer itself was a mistake and the old ticket needs to become active
  again, clear the `end_date` field that was set on it — this is a normal
  edit, not a distinct "restore" operation.
- **End a running ticket early:** edit its `end_date` to the desired
  date.

Because tickets are independent rows, composite situations resolve by
applying these same operations more than once with no special-casing —
e.g. "staff A's evening coverage at Outlet 3 ends early and A moves to a
temporary shift at Outlet 4, while a different staff member C takes over
A's vacated Outlet 3 slot" is: (1) transfer A's Outlet 3 ticket to Outlet
4, effective the changeover date, optionally with its own end date if A's
Outlet 4 stint is also temporary; and (2) separately create a new ticket
for C at the Outlet 3 slot, covering the remaining original date range.
The system does not need to understand that these two tickets are related
to each other.

## Backfill (existing data)

For each brand that exists today:

1. Create one default `Outlet` named after the brand (or a clearly-labeled
   default name), representing wherever that brand currently operates.
2. Create one `Outlet_Brand_Slot` for that outlet: the brand, `00:00`–
   `24:00`.
3. Create one open-ended `Staff_Slot_Assignment` ticket per staff member
   currently associated with that brand, pointing at the new slot.
4. Set `outlet_id` on every historical order to the default outlet of its
   `brand_id`.

No staff, outlet, or scheduling behavior changes for a brand that never
introduces a second slot — this backfill reproduces today's single-brand,
single-location behavior exactly.

## Open Items for the Implementation Plan

These are implementation-level details deliberately left for the
`writing-plans` phase, not resolved here:

- Exact table/column DDL, indexes, and migration numbering.
- Exact UI location and components for the staff-profile ticket screens
  and the manager outlet-picker.
- Exact validation rules enforced at the database vs. application layer.
- Whether outlet/slot management is a new admin section or folded into
  existing staff-management screens.
