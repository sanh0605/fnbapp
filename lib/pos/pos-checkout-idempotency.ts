export type PosCheckoutAttempt = {
  requestToken: string;
  requestFingerprint: string;
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
