import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// public/pos-sw.js is a kill switch for tills that registered the old
// offline worker (BR-SALE-015). It needs a ServiceWorkerGlobalScope to run,
// so these are source-text checks.
describe("public/pos-sw.js kill switch", () => {
  const source = readFileSync(resolve(__dirname, "../../public/pos-sw.js"), "utf8");

  it("takes over at once, deletes every cache and unregisters itself", () => {
    expect(source).toContain('addEventListener("install"');
    expect(source).toContain("self.skipWaiting()");
    expect(source).toContain('addEventListener("activate"');
    expect(source).toMatch(/caches\s*\.keys\(\)[\s\S]*caches\.delete\(key\)/);
    expect(source).toContain("self.registration.unregister()");
  });

  it("serves nothing: no fetch handler, no cache writes", () => {
    expect(source).not.toContain('addEventListener("fetch"');
    expect(source).not.toContain("cache.put(");
  });
});
