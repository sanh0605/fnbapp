import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-012 (owner 2026-10-11, option b): every admin page sits in one frame
// at most 1,280 px wide, centred. On a laptop the space beside the menu is
// narrower than that, so pages fill it; on a 1,920 px screen they no longer
// spread to 1,584 px while others stop at 672.

const layout = readFileSync(join(process.cwd(), "app", "admin", "layout.tsx"), "utf8");

describe("BR-UI-012 one page frame", () => {
  it("the admin frame is at most 1,280 px and centred", () => {
    expect(layout).toMatch(/className="max-w-screen-xl mx-auto w-full[ "]/);
  });

  it("the old 1,920 px frame is gone", () => {
    expect(layout).not.toContain("max-w-[1920px]");
  });
});
