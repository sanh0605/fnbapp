import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("client error boundary reporting", () => {
  it.each([
    ["app/error.tsx", "global-error"],
    ["app/global-error.tsx", "root-global-error"],
  ])("reports %s failures through the authenticated client error endpoint", (path, source) => {
    const content = readFileSync(path, "utf8");

    expect(content).toContain('from "@/lib/client-error-report"');
    expect(content).toContain(`reportClientError("${source}", error)`);
  });
});
