import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
}));

import { DELETE, GET, PATCH, POST } from "./route";

function patchRequest(body: unknown) {
  return new Request("https://fnb.example/api/dev-feedback", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const TWO_ENTRIES =
  '# Góp ý giao diện\n\n## [2026-08-26T10:00:00.000Z] id-keep01\n- Route: /pos\n- Viewport: 390px\n\nGhi chú: giữ lại\n\n---\n\n## [2026-08-26T11:00:00.000Z] id-edit01\n- Route: /pos\n- Viewport: 390px\n\nGhi chú: cũ\n\n---\n';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string) {
  // @ts-expect-error -- NODE_ENV is typed readonly by @types/node, but is a
  // plain process.env string at runtime and freely reassignable in tests.
  process.env.NODE_ENV = value;
}

function postRequest(body: unknown) {
  return new Request("https://fnb.example/api/dev-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new Request(`https://fnb.example/api/dev-feedback?id=${id}`, { method: "DELETE" });
}

describe("dev-feedback API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNodeEnv("development");
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    mocks.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setNodeEnv(ORIGINAL_NODE_ENV || "test");
  });

  // Plan section 6's second guard: refuses outside development regardless
  // of whether the client bundle somehow shipped.
  describe("in production", () => {
    beforeEach(() => setNodeEnv("production"));

    it("GET returns 404 and never reads the file", async () => {
      const res = await GET();
      expect(res.status).toBe(404);
      expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it("POST returns 404 and never writes the file", async () => {
      const res = await POST(postRequest({ note: "test" }));
      expect(res.status).toBe(404);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("DELETE returns 404 and never writes the file", async () => {
      const res = await DELETE(deleteRequest("abc"));
      expect(res.status).toBe(404);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("returns 404 in production and never writes", async () => {
      setNodeEnv("production");
      const res = await PATCH(patchRequest({ id: "edit01", note: "mới" }));
      expect(res.status).toBe(404);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("rejects invalid JSON", async () => {
      const res = await PATCH(patchRequest("{not json"));
      expect(res.status).toBe(400);
    });

    it("requires an id", async () => {
      const res = await PATCH(patchRequest({ note: "mới" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "id is required" });
    });

    it("requires a non-empty note after trim", async () => {
      mocks.readFile.mockResolvedValue(TWO_ENTRIES);
      const res = await PATCH(patchRequest({ id: "edit01", note: "   " }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "note is required" });
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown id", async () => {
      mocks.readFile.mockResolvedValue(TWO_ENTRIES);
      const res = await PATCH(patchRequest({ id: "zzz", note: "mới" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not found" });
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("updates only the named note, trimmed, and returns the entry", async () => {
      mocks.readFile.mockResolvedValue(TWO_ENTRIES);
      const res = await PATCH(patchRequest({ id: "edit01", note: "  mới  " }));
      expect(res.status).toBe(200);
      expect((await res.json()).entry.note).toBe("mới");
      const [, written] = mocks.writeFile.mock.calls[0];
      expect(written).toContain("Ghi chú: giữ lại");
      expect(written).toContain("Ghi chú: mới");
      expect(written).not.toContain("Ghi chú: cũ");
    });
  });

  describe("in development", () => {
    it("GET returns an empty list when the file does not exist yet", async () => {
      const res = await GET();
      const body = await res.json();
      expect(body.entries).toEqual([]);
    });

    it("POST rejects a comment with no note", async () => {
      const res = await POST(postRequest({ route: "/pos" }));
      expect(res.status).toBe(400);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("POST accepts a general comment with no element attached", async () => {
      const res = await POST(postRequest({ note: "Trang này ổn.", route: "/admin/outlets", viewportWidth: 1440 }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.entry.selector).toBeNull();
      expect(body.entry.note).toBe("Trang này ổn.");
      expect(mocks.writeFile).toHaveBeenCalledOnce();
    });

    it("POST writes the appended file content, including the new note", async () => {
      await POST(postRequest({
        note: "Nút bị che.",
        route: "/pos",
        viewportWidth: 390,
        selector: "div > button",
        className: "bg-primary",
        textSnippet: "TIỀN MẶT",
        sourceFile: "app/pos/components/CartPanel.tsx",
        sourceLine: 508,
        sourceColumn: 7,
      }));

      const [, writtenContent] = mocks.writeFile.mock.calls[0];
      expect(writtenContent).toContain("Nút bị che.");
      expect(writtenContent).toContain("app/pos/components/CartPanel.tsx:508:7");
    });

    it("DELETE requires an id", async () => {
      const res = await DELETE(new Request("https://fnb.example/api/dev-feedback", { method: "DELETE" }));
      expect(res.status).toBe(400);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("DELETE removes only the named entry", async () => {
      mocks.readFile.mockResolvedValue(
        '# Góp ý giao diện\n\n## [2026-08-26T10:00:00.000Z] id-keep01\n- Route: /pos\n- Viewport: 390px\n\nGhi chú: giữ lại\n\n---\n\n## [2026-08-26T11:00:00.000Z] id-gone01\n- Route: /pos\n- Viewport: 390px\n\nGhi chú: xoá cái này\n\n---\n',
      );

      const res = await DELETE(deleteRequest("gone01"));
      expect(res.status).toBe(204);

      const [, writtenContent] = mocks.writeFile.mock.calls[0];
      expect(writtenContent).toContain("id-keep01");
      expect(writtenContent).not.toContain("id-gone01");
    });
  });
});
