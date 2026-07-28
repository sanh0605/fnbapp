import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-text checks for public/pos-sw.js. The service worker's own cache
// writes can't run as normal DOM/fetch unit tests without a full
// ServiceWorkerGlobalScope + Cache API polyfill, which is out of proportion
// to what this file needs -- so this asserts the cache-write guard is
// actually present at both call sites the way the offline-resilience
// design requires, the same convention components/POSScreen.offline.test.tsx
// uses for source it can't easily execute in a unit test either.
describe("public/pos-sw.js cache-write safety", () => {
  const source = readFileSync(resolve(__dirname, "../public/pos-sw.js"), "utf8");
  const cachePutSites = [...source.matchAll(/cache\.put\(/g)];

  it("has exactly the two expected cache.put call sites", () => {
    expect(cachePutSites).toHaveLength(2);
  });

  it("never caches a redirected or non-2xx response under either cache.put call", () => {
    // For each cache.put(...) occurrence, look at the code immediately
    // preceding it and require both guards to be present -- a redirected
    // response (e.g. an unauthenticated request bounced to a login page)
    // or a non-2xx response must never be written under the /pos or static
    // asset cache key.
    for (const match of cachePutSites) {
      const precedingCode = source.slice(0, match.index);
      const guardWindow = precedingCode.slice(Math.max(0, precedingCode.length - 300));
      expect(guardWindow).toMatch(/response\.ok/);
      expect(guardWindow).toMatch(/!response\.redirected/);
    }
  });
});
