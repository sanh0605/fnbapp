export type Purchase = {
  purchased_item_id: string;
  at: string;
  base_quantity: number;
  subtotal: number;
};

export type Issue = {
  purchased_item_id: string;
  at: string;
  base_quantity: number;
  source: "STOCKTAKE" | "MANUAL";
};

export type ItemCost = {
  purchased_item_id: string;
  issued_quantity: number;
  issued_value: number;
  closing_quantity: number;
  closing_value: number;
};

type Event =
  | { kind: "purchase"; atMs: number; seq: number; base_quantity: number; subtotal: number }
  | { kind: "issue"; atMs: number; seq: number; base_quantity: number };

// K5: two events at the exact same instant need a deterministic order, not
// whatever a sort happens to preserve. Purchase before issue -- goods must
// land before they can be measured leaving -- then by seq, the order the
// caller's arrays were given in (all purchases in their input order, then
// all issues in their input order, matching how this function has always
// built its per-item event lists). This is a last resort: D7 gives issue
// slips a time of day precisely so real same-instant ties become rare, not
// the normal way order is decided.
function eventOrder(event: Event): number {
  return event.kind === "purchase" ? 0 : 1;
}

function parseAt(purchasedItemId: string, at: string): number {
  const ms = new Date(at).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`${purchasedItemId}: unusable timestamp (${JSON.stringify(at)})`);
  }
  return ms;
}

export function computeIssueCosting(purchases: Purchase[], issues: Issue[]): ItemCost[] {
  const eventsByItem = new Map<string, Event[]>();
  let seq = 0;

  for (const p of purchases) {
    if (p.base_quantity <= 0 && p.subtotal > 0) {
      throw new Error(`${p.purchased_item_id}: purchase has money but no quantity (subtotal ${p.subtotal})`);
    }
    const atMs = parseAt(p.purchased_item_id, p.at);
    const list = eventsByItem.get(p.purchased_item_id) ?? [];
    list.push({ kind: "purchase", atMs, seq: seq++, base_quantity: p.base_quantity, subtotal: p.subtotal });
    eventsByItem.set(p.purchased_item_id, list);
  }
  for (const i of issues) {
    const atMs = parseAt(i.purchased_item_id, i.at);
    const list = eventsByItem.get(i.purchased_item_id) ?? [];
    list.push({ kind: "issue", atMs, seq: seq++, base_quantity: i.base_quantity });
    eventsByItem.set(i.purchased_item_id, list);
  }

  const results: ItemCost[] = [];

  for (const [purchasedItemId, events] of eventsByItem) {
    events.sort((a, b) => a.atMs - b.atMs || eventOrder(a) - eventOrder(b) || a.seq - b.seq);

    let quantity = 0;
    let value = 0;
    // BR-INV-008 ("hàng tìm lại được"): the rate the last unit left at,
    // remembered separately from value/quantity because that ratio is 0/0
    // (NaN) once the pool is empty. Only ever read when quantity is 0.
    let lastUnitCost: number | null = null;
    let issuedQuantity = 0;
    let issuedValue = 0;

    for (const event of events) {
      if (event.kind === "purchase") {
        quantity += event.base_quantity;
        value += event.subtotal;
        continue;
      }

      // Issue event. base_quantity > 0 is a real outflow. base_quantity < 0
      // is BR-INV-008's "found stock" -- a count that came back higher than
      // theoretical, stored as a negative stock_issues row so it replays
      // through the same event stream rather than a parallel mechanism.
      if (event.base_quantity > 0) {
        if (quantity <= 0) {
          throw new Error(`${purchasedItemId}: issue precedes any purchase`);
        }
        if (event.base_quantity > quantity) {
          throw new Error(`${purchasedItemId}: issue exceeds quantity on hand`);
        }

        const unitCost = value / quantity;
        lastUnitCost = unitCost;
        const thisIssueValue = unitCost * event.base_quantity;
        quantity -= event.base_quantity;
        value -= thisIssueValue;
        // Floating-point subtraction can leave a residue like 1e-10 instead
        // of exactly 0 once the pool is truly empty -- clear it rather than
        // let it accumulate through however many events follow. The rate is
        // preserved separately in lastUnitCost, not lost by this reset.
        if (quantity === 0) value = 0;
        issuedQuantity += event.base_quantity;
        issuedValue += thisIssueValue;
      } else if (event.base_quantity < 0) {
        // Found stock never happened without some purchase establishing a
        // rate at some point in this item's history -- if quantity is 0 AND
        // no rate was ever recorded, nothing to value it against.
        if (quantity <= 0 && lastUnitCost === null) {
          throw new Error(`${purchasedItemId}: found stock has no purchase to value it against`);
        }
        const foundQuantity = -event.base_quantity;
        const foundUnitCost = quantity > 0 ? value / quantity : lastUnitCost!;
        quantity += foundQuantity;
        value += foundQuantity * foundUnitCost;
        // A found event reverses a prior issue's effect on the period
        // totals, not a new kind of outflow -- net issued_quantity/value is
        // what a period's cost is built from (computePeriodIssuedValue).
        issuedQuantity -= foundQuantity;
        issuedValue -= foundQuantity * foundUnitCost;
      }
    }

    results.push({
      purchased_item_id: purchasedItemId,
      issued_quantity: issuedQuantity,
      issued_value: issuedValue,
      closing_quantity: quantity,
      closing_value: value,
    });
  }

  return results;
}

// computeIssueCosting returns a cumulative total per item, not a value per
// issue event -- an issue's cost depends on the weighted average at the
// moment it happened, which depends on every event before it, so there is
// no way to price one month's issues without replaying everything that
// preceded them. A period's figure is therefore two full replays and a
// subtraction: everything issued up to the period's end, minus everything
// issued before the period started.
//
// Both replays are given the SAME complete purchase set. The subtraction is
// only valid because the two replays share an identical prefix; narrowing
// the purchase set for either one would silently invalidate it while still
// returning a plausible-looking number. Passing every completed purchase
// regardless of period is safe: the replay is chronological, so a purchase
// dated after the last issue in a run cannot change any issue's value, it
// only lands in that run's (discarded) closing_value.
export function computePeriodIssuedValue(
  purchases: Purchase[],
  allIssues: Issue[],
  startUtc: Date | null,
  endUtc: Date | null,
): number {
  const issuesThroughEnd = endUtc
    ? allIssues.filter(i => new Date(i.at).getTime() <= endUtc.getTime())
    : allIssues;
  const throughEnd = computeIssueCosting(purchases, issuesThroughEnd);

  if (!startUtc) {
    return throughEnd.reduce((sum, item) => sum + item.issued_value, 0);
  }

  const issuesBeforeStart = allIssues.filter(i => new Date(i.at).getTime() < startUtc.getTime());
  const beforeStart = computeIssueCosting(purchases, issuesBeforeStart);
  const beforeValueByItem = new Map(beforeStart.map(item => [item.purchased_item_id, item.issued_value]));

  return throughEnd.reduce(
    (sum, item) => sum + (item.issued_value - (beforeValueByItem.get(item.purchased_item_id) || 0)),
    0,
  );
}
