// Order code derivation, pure and testable without a database, mirroring
// how lib/asset-depreciation.ts and lib/issue-costing.ts are structured.
//
// docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 4.
// New format: YY MM DD (Asia/Ho_Chi_Minh) + outlet code (3 digits) +
// sequence (3 digits) = 12 digits total, e.g. "260824001001". Date first
// so the all-digit code sorts chronologically as plain text and has no
// leading zero for a numeric round-trip to eat.

const SAIGON_TZ = "Asia/Ho_Chi_Minh";

// Same Intl.DateTimeFormat approach as lib/datetime.ts's (private)
// getSaigonParts -- not reused directly because that function returns
// hour/minute/second this module never needs, and duplicating three lines
// of date-part extraction is cheaper than exporting a second timezone
// helper from a file this one has no other reason to depend on.
export function formatOrderDate(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAIGON_TZ,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const get = (type: string) => parts.find(p => p.type === type)?.value || "00";
  return `${get("year")}${get("month")}${get("day")}`;
}

// The exact shape distinguishing an already-renamed row from a legacy one
// -- 12 digits, nothing else. Legacy codes always start with a letter
// prefix (brand code) or "#", so this never false-positives against real
// data (checked against all 2.355 live order_no values before writing this).
const NEW_FORMAT = /^\d{12}$/;

export function isNewFormatOrderNo(orderNo: string): boolean {
  return NEW_FORMAT.test(orderNo);
}

export function buildOrderCode(dateYYMMDD: string, outletCode: string, sequence: number): string {
  return `${dateYYMMDD}${outletCode}${String(sequence).padStart(3, "0")}`;
}

export type RawOrderRow = {
  id: string;
  order_no: string;
  brand_id: string;
  created_at: string; // ISO
};

export type OutletForBrand = { outlet_id: string; outlet_code: string; brand_id: string };

export type OrderCodeGroupPlan = {
  old_order_no: string;
  new_order_no: string;
  outlet_id: string;
  row_ids: string[];
  changed: boolean; // new_order_no !== old_order_no
};

// Derives the desired end state from first principles (created_at and
// brand_id, neither of which ever changes) rather than special-casing
// "is this row already renamed" -- idempotent by construction: a second
// run recomputes the identical groups and sequence, `changed` comes back
// false for every one, and the caller (the script) writes nothing. The
// per-(outlet,date) sequence's tie-break (old_order_no, i.e. whatever the
// CURRENT order_no is at the time this runs) is stable across runs for the
// same reason -- new codes are assigned in exactly the order this tie-break
// produces, so sorting by the now-assigned new codes on a later run
// reproduces the same order the first run baked in.
export function planOrderCodeRename(
  orders: RawOrderRow[],
  outlets: OutletForBrand[],
): OrderCodeGroupPlan[] {
  const outletByBrand = new Map<string, OutletForBrand>();
  for (const o of outlets) {
    if (outletByBrand.has(o.brand_id)) {
      throw new Error(`brand ${o.brand_id} has more than one outlet -- the thin-slice model assumes exactly one`);
    }
    outletByBrand.set(o.brand_id, o);
  }

  const groupsByOrderNo = new Map<string, RawOrderRow[]>();
  for (const row of orders) {
    const list = groupsByOrderNo.get(row.order_no) ?? [];
    list.push(row);
    groupsByOrderNo.set(row.order_no, list);
  }

  type Derived = {
    old_order_no: string;
    outlet: OutletForBrand;
    date: string;
    earliestCreatedAt: string;
    row_ids: string[];
  };

  const derived: Derived[] = [];
  for (const [oldOrderNo, rows] of groupsByOrderNo) {
    const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const earliest = sorted[0];
    const outlet = outletByBrand.get(earliest.brand_id);
    if (!outlet) {
      throw new Error(`order ${oldOrderNo}: no outlet found for brand ${earliest.brand_id}`);
    }
    derived.push({
      old_order_no: oldOrderNo,
      outlet,
      date: formatOrderDate(earliest.created_at),
      earliestCreatedAt: earliest.created_at,
      row_ids: rows.map(r => r.id),
    });
  }

  // Section 4 step 4: row_number() over groups sharing an outlet and date,
  // ordered by the group's earliest created_at, then by (current) order_no
  // to break ties deterministically.
  derived.sort((a, b) => {
    if (a.outlet.outlet_id !== b.outlet.outlet_id) return a.outlet.outlet_id < b.outlet.outlet_id ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const t = new Date(a.earliestCreatedAt).getTime() - new Date(b.earliestCreatedAt).getTime();
    if (t !== 0) return t;
    return a.old_order_no < b.old_order_no ? -1 : a.old_order_no > b.old_order_no ? 1 : 0;
  });

  const plans: OrderCodeGroupPlan[] = [];
  let sequence = 0;
  let lastKey = "";
  for (const group of derived) {
    const key = `${group.outlet.outlet_id}|${group.date}`;
    sequence = key === lastKey ? sequence + 1 : 1;
    lastKey = key;

    const newOrderNo = buildOrderCode(group.date, group.outlet.outlet_code, sequence);
    plans.push({
      old_order_no: group.old_order_no,
      new_order_no: newOrderNo,
      outlet_id: group.outlet.outlet_id,
      row_ids: group.row_ids,
      changed: newOrderNo !== group.old_order_no,
    });
  }

  return plans;
}
