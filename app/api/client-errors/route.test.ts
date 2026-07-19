import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ resolveActor: resolveActorMock }));

import { POST } from "./route";

const validPayload = {
  source: "global-error",
  message: "render failed",
  stack: "Error: render failed\n at POSScreen",
  digest: "digest-1",
  url: "https://fnb.example/pos",
  timestamp: "2026-07-19T12:34:56.000Z",
};

function request(payload: unknown) {
  return new Request("https://fnb.example/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/client-errors", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    resolveActorMock.mockResolvedValue({
      ok: true,
      actor: { id: "user-1", name: "cashier", role: "STAFF" },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("rejects unauthenticated reports without writing a server log", async () => {
    resolveActorMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(401);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed reports", async () => {
    const response = await POST(request({ source: "global-error", message: "" }));

    expect(response.status).toBe(400);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("writes one bounded authenticated record to the server log", async () => {
    const response = await POST(request(validPayload));

    expect(response.status).toBe(204);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ClientError]",
      expect.any(String),
    );
    const record = JSON.parse(consoleErrorSpy.mock.calls[0][1] as string);
    expect(record).toMatchObject({
      ...validPayload,
      actor: { id: "user-1", name: "cashier", role: "STAFF" },
    });
    expect(record.receivedAt).toEqual(expect.any(String));
  });
});
