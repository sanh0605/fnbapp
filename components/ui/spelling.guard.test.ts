import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-001: one way of writing each word. Measured 2026-10-14 the screens
// wrote the tone mark on the second vowel (huỷ, hoá, xoá, tuỳ) about 500
// times and on the first (hủy, hóa) 47 times, so the majority stays. The POS
// (app/pos) keeps its own text until its own wave (master plan part 7).
// "Chủ Nhật" from Intl's weekday names (lib/shared/datetime.ts) is not
// written in the source and is not scanned.

const MINORITY = /óa|òa|ỏa|õa|ọa|óe|òe|ỏe|õe|ọe|úy|ùy|ủy|ũy|ụy/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("BR-UI-001 one spelling for each word", () => {
  it("no screen writes huỷ, hoá, xoá, tuỳ, khoá the other way", () => {
    const root = process.cwd();
    const offenders = ["app/admin", "app/settings", "components", "lib"]
      .flatMap(dir => sources(join(root, dir)))
      .filter(f => MINORITY.test(readFileSync(f, "utf8")))
      .map(f => relative(root, f).split(sep).join("/"));
    expect(offenders).toEqual([]);
  });
});
