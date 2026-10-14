import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-013 (owner 2026-10-11): a page that creates a record is titled "Tạo"
// plus what it creates, matching its list's "Tạo" button (BR-UI-002), and a
// title capitalises only its first word — "Tạo đơn vị tính", not
// "Thêm Đơn Vị Mới". Names keep their own capitals.

const NAMES = new Set(["Topping", "Voucher"]);

function createPages(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return createPages(full);
    const inNew = full.split(sep).includes("new");
    if (!inNew || (name !== "page.tsx" && name !== "loading.tsx")) return [];
    return [full];
  });
}

const root = process.cwd();
const pages = createPages(join(root, "app", "admin")).map(f => {
  const src = readFileSync(f, "utf8");
  return { path: relative(root, f).split(sep).join("/"), title: /title="([^"]+)"/.exec(src)?.[1] ?? null };
}).filter(p => p.title !== null); // a skeleton loading.tsx draws no title

describe("BR-UI-013 create page titles", () => {
  it("every create page is titled 'Tạo …'", () => {
    const offenders = pages.filter(p => !p.title?.startsWith("Tạo ")).map(p => `${p.path}: ${p.title}`);
    expect(offenders).toEqual([]);
  });

  it("only the first word of a title is capitalised", () => {
    const offenders = pages
      .filter(p => p.title?.split(" ").slice(1).some(w => /^\p{Lu}/u.test(w) && !NAMES.has(w)))
      .map(p => `${p.path}: ${p.title}`);
    expect(offenders).toEqual([]);
  });

  it("the scan reads real files (not a vacuous pass)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(19);
    expect(pages.some(p => p.path === "app/admin/inventory/units/new/page.tsx")).toBe(true);
  });
});
