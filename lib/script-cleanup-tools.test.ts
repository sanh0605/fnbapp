import { describe, expect, it } from "vitest";
import {
  getSaigonDateStamp,
  hasScriptReference,
  parseDeleteOneOffList,
} from "./script-cleanup-tools";

describe("getSaigonDateStamp", () => {
  it("uses the Vietnam calendar date across the UTC day boundary", () => {
    expect(getSaigonDateStamp(new Date("2026-07-18T23:30:00.000Z")))
      .toBe("2026-07-19");
  });
});

describe("parseDeleteOneOffList", () => {
  it("reads only script names from the DELETE_ONE_OFF section", () => {
    const plan = [
      "## KEEP_AUDIT (1)",
      "- `audit-live.ts` — keep",
      "",
      "## DELETE_ONE_OFF (2)",
      "- `foo.ts` — one-off",
      "- `bar.js` — one-off",
      "",
      "## Recommended actions",
      "- `not-a-candidate.ts`",
    ].join("\r\n");

    expect(parseDeleteOneOffList(plan)).toEqual(["foo.ts", "bar.js"]);
  });
});

describe("hasScriptReference", () => {
  it.each([
    'import value from "./foo";',
    "import value from '../foo.ts';",
    'const value = require("./foo");',
    "const value = require('../foo.ts');",
    'import value from "../scripts/foo";',
    'await import("@/scripts/foo.ts");',
    'execSync("vite-node scripts/foo.ts");',
    'const command = "scripts\\foo.ts --apply";',
  ])("detects a substantive reference: %s", content => {
    expect(hasScriptReference(content, "foo.ts")).toBe(true);
  });

  it.each([
    'import value from "./foo-extra";',
    'const path = "scripts/foo.tsx";',
    'const path = "scripts/foo.ts.bak";',
    'const word = "foo.ts";',
  ])("does not over-match an unrelated path: %s", content => {
    expect(hasScriptReference(content, "foo.ts")).toBe(false);
  });
});
