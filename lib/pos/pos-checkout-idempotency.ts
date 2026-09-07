export type PosCheckoutAttempt = {
  requestToken: string;
  requestFingerprint: string;
};

export type PosCheckoutRequestIdSummary = {
  totalOrders: number;
  ordersWithRequestId: number;
  legacyOrdersWithoutRequestId: number;
  duplicateRequestIds: Array<{
    requestId: string;
    orderIds: string[];
  }>;
};

export function resolvePosCheckoutAttempt(
  current: PosCheckoutAttempt | null,
  checkoutPayload: unknown,
  createToken: () => string = () => crypto.randomUUID(),
): PosCheckoutAttempt {
  const requestFingerprint = stableSerialize(checkoutPayload);
  if (current?.requestFingerprint === requestFingerprint) {
    return current;
  }

  const requestToken = createToken().trim();
  if (!requestToken) {
    throw new Error("POS checkout request token must not be empty");
  }

  return { requestToken, requestFingerprint };
}

export function summarizePosCheckoutRequestIds(
  orders: Array<{ id: unknown; client_request_id?: unknown }>,
): PosCheckoutRequestIdSummary {
  const orderIdsByRequestId = new Map<string, string[]>();
  let ordersWithRequestId = 0;

  for (const order of orders) {
    const requestId = String(order.client_request_id || "").trim();
    if (!requestId) continue;
    ordersWithRequestId += 1;
    const orderIds = orderIdsByRequestId.get(requestId) || [];
    orderIds.push(String(order.id || ""));
    orderIdsByRequestId.set(requestId, orderIds);
  }

  const duplicateRequestIds = Array.from(orderIdsByRequestId.entries())
    .filter(([, orderIds]) => orderIds.length > 1)
    .map(([requestId, orderIds]) => ({ requestId, orderIds }))
    .sort((left, right) => left.requestId.localeCompare(right.requestId));

  return {
    totalOrders: orders.length,
    ordersWithRequestId,
    legacyOrdersWithoutRequestId: orders.length - ordersWithRequestId,
    duplicateRequestIds,
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
  return `{${entries.join(",")}}`;
}
