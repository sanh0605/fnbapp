import { describe, expect, it, vi } from "vitest";

// withAuth is replaced so the middleware function and the authorized callback can be called directly.
vi.mock("next-auth/middleware", () => ({
  withAuth: (middleware: unknown, options: unknown) => ({ middleware, options }),
}));

import proxy, { config } from "./proxy";

const { middleware, options } = proxy as unknown as {
  middleware: (req: any) => Response | undefined;
  options: { callbacks: { authorized: (a: { token: unknown }) => boolean } };
};

const req = (role: string, path: string) => ({
  nextauth: { token: { role } },
  nextUrl: { pathname: path },
  url: `http://localhost${path}`,
});

describe("proxy", () => {
  it("sends STAFF on /admin back to /pos", () => {
    const res = middleware(req("STAFF", "/admin/products"))!;
    expect(new URL(res.headers.get("location")!).pathname).toBe("/pos");
  });

  it("lets STAFF stay on /pos", () => {
    expect(middleware(req("STAFF", "/pos"))).toBeUndefined();
  });

  it("lets MANAGER and ADMIN through on /admin", () => {
    expect(middleware(req("MANAGER", "/admin"))).toBeUndefined();
    expect(middleware(req("ADMIN", "/admin"))).toBeUndefined();
  });

  it("does not authorise a request without a token", () => {
    expect(options.callbacks.authorized({ token: null })).toBe(false);
    expect(options.callbacks.authorized({ token: { role: "STAFF" } })).toBe(true);
  });

  it("guards only /pos and /admin, so /login stays public", () => {
    expect(config.matcher).toEqual(["/pos/:path*", "/admin/:path*"]);
  });
});
