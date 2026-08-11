export type RebuildScopeInput = {
  allOrderIds: string[];
  replayErrors: string[];
  computedRowsByOrder: Map<string, unknown[]>;
};

export type RebuildScope = {
  rebuildOrderIds: string[];
  excludedOrderIds: string[];
  exclusionReasons: Map<string, string>;
};

/**
 * Replay errors are reported as "<order_no or order_id>/<line_id>: <message>".
 * An order with any failed line is excluded outright: rebuilding it would
 * delete its full derived row set and reinsert one missing that line's
 * consumption, which is silently wrong and unrecoverable without another
 * rebuild.
 */
export function selectRebuildableOrders(input: RebuildScopeInput): RebuildScope {
  const reasons = new Map<string, string>();
  for (const error of input.replayErrors) {
    const orderKey = error.split("/")[0];
    if (!orderKey) continue;
    if (!reasons.has(orderKey)) reasons.set(orderKey, error);
  }

  const rebuildOrderIds: string[] = [];
  const excludedOrderIds: string[] = [];
  for (const orderId of input.allOrderIds) {
    const failed = reasons.has(orderId);
    const rows = input.computedRowsByOrder.get(orderId) || [];
    if (failed || rows.length === 0) {
      excludedOrderIds.push(orderId);
      if (!reasons.has(orderId)) reasons.set(orderId, "replay produced no rows");
      continue;
    }
    rebuildOrderIds.push(orderId);
  }

  return { rebuildOrderIds, excludedOrderIds, exclusionReasons: reasons };
}
