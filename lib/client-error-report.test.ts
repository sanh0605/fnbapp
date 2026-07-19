import { describe, expect, it, vi } from "vitest";
import {
  buildClientErrorPayload,
  normalizeClientErrorPayload,
  reportClientError,
} from "./client-error-report";

describe("client error reporting", () => {
  it("keeps only bounded diagnostic fields", () => {
    const payload = normalizeClientErrorPayload({
      source: "root-global-error",
      message: "m".repeat(1_200),
      stack: "s".repeat(9_000),
      digest: "d".repeat(300),
      url: `https://example.com/${"u".repeat(2_100)}`,
      timestamp: "2026-07-19T12:34:56.000Z",
      ignored: "must not survive",
    });

    expect(payload).toEqual({
      source: "root-global-error",
      message: "m".repeat(1_000),
      stack: "s".repeat(8_000),
      digest: "d".repeat(256),
      url: `https://example.com/${"u".repeat(2_028)}`,
      timestamp: "2026-07-19T12:34:56.000Z",
    });
  });

  it("builds a serializable payload from an Error", () => {
    const error = Object.assign(new Error("checkout crashed"), {
      digest: "digest-1",
    });
    error.stack = "stack-1";

    expect(buildClientErrorPayload(
      "global-error",
      error,
      "https://fnb.example/pos",
      "2026-07-19T12:34:56.000Z",
    )).toEqual({
      source: "global-error",
      message: "checkout crashed",
      stack: "stack-1",
      digest: "digest-1",
      url: "https://fnb.example/pos",
      timestamp: "2026-07-19T12:34:56.000Z",
    });
  });

  it("sends the same browser error only once and never throws on logging failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network unavailable"));
    const error = new Error("render failed");

    await expect(reportClientError(
      "global-error",
      error,
      {
        fetch: fetchMock as typeof fetch,
        url: "https://fnb.example/admin",
        timestamp: "2026-07-19T12:34:56.000Z",
      },
    )).resolves.toBeUndefined();
    await reportClientError(
      "global-error",
      error,
      {
        fetch: fetchMock as typeof fetch,
        url: "https://fnb.example/admin",
        timestamp: "2026-07-19T12:34:56.000Z",
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/client-errors", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    }));
  });
});
