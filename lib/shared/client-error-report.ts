export type ClientErrorSource = "global-error" | "root-global-error";

export type ClientErrorPayload = {
  source: ClientErrorSource;
  message: string;
  stack: string;
  digest: string;
  url: string;
  timestamp: string;
};

type ReportClientErrorDependencies = {
  fetch?: typeof fetch;
  url?: string;
  timestamp?: string;
};

const LIMITS = {
  message: 1_000,
  stack: 8_000,
  digest: 256,
  url: 2_048,
} as const;

const reportedFingerprints = new Set<string>();

function boundedString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

export function normalizeClientErrorPayload(input: unknown): ClientErrorPayload | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  const source = candidate.source;
  if (source !== "global-error" && source !== "root-global-error") return null;

  const message = boundedString(candidate.message, LIMITS.message);
  if (!message.trim()) return null;

  const timestampValue = boundedString(candidate.timestamp, 64);
  const timestamp = Number.isNaN(Date.parse(timestampValue))
    ? new Date().toISOString()
    : timestampValue;

  return {
    source,
    message,
    stack: boundedString(candidate.stack, LIMITS.stack),
    digest: boundedString(candidate.digest, LIMITS.digest),
    url: boundedString(candidate.url, LIMITS.url),
    timestamp,
  };
}

export function buildClientErrorPayload(
  source: ClientErrorSource,
  error: Error & { digest?: string },
  url: string,
  timestamp: string,
): ClientErrorPayload {
  return {
    source,
    message: boundedString(error.message || error.name || "Unknown client error", LIMITS.message),
    stack: boundedString(error.stack, LIMITS.stack),
    digest: boundedString(error.digest, LIMITS.digest),
    url: boundedString(url, LIMITS.url),
    timestamp,
  };
}

export async function reportClientError(
  source: ClientErrorSource,
  error: Error & { digest?: string },
  dependencies: ReportClientErrorDependencies = {},
): Promise<void> {
  const payload = buildClientErrorPayload(
    source,
    error,
    dependencies.url ?? (typeof window === "undefined" ? "" : window.location.href),
    dependencies.timestamp ?? new Date().toISOString(),
  );
  const fingerprint = JSON.stringify({
    source: payload.source,
    message: payload.message,
    stack: payload.stack,
    digest: payload.digest,
    url: payload.url,
  });
  if (reportedFingerprints.has(fingerprint)) return;
  reportedFingerprints.add(fingerprint);

  const fetchImpl = dependencies.fetch ?? fetch;
  try {
    await fetchImpl("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch {
    // Error reporting must never trigger another application error boundary.
  }
}
