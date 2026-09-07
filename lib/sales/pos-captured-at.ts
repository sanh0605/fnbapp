/**
 * Sanity-bounds a client-supplied sale timestamp before it becomes an
 * order's created_at. Exists only to guard against a grossly misconfigured
 * device clock -- not a feature in its own right, expected to reject
 * close to never.
 */

const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutes

export function resolveCapturedAt(
  clientCapturedAt: string | undefined,
  serverNow: Date = new Date(),
): { createdAt: string; rejected: boolean } {
  const fallback = serverNow.toISOString();

  if (!clientCapturedAt) {
    return { createdAt: fallback, rejected: false };
  }

  const clientMs = new Date(clientCapturedAt).getTime();
  if (!Number.isFinite(clientMs)) {
    return { createdAt: fallback, rejected: true };
  }

  const deltaMs = clientMs - serverNow.getTime();
  if (deltaMs > MAX_FUTURE_MS || deltaMs < -MAX_PAST_MS) {
    return { createdAt: fallback, rejected: true };
  }

  return { createdAt: clientCapturedAt, rejected: false };
}
