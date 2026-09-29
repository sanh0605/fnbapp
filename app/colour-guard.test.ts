import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 3.1: four colours,
// fixed in code (owner Q8b). Screens use the CSS-variable names only.
const ALLOWED_HEX = new Set([
  "#F7F5F0", "#FFFFFF", "#1F1B16", "#5E574E", "#E4DFD5", "#8A5A1F", "#F2E8D8", "#B3261E",
  // pie-chart shades of the primary, CategoryPieChart.tsx
  "#A57A45", "#BF9A6B", "#D6BC96", "#E9DBC4", "#5E3D14", "#744B19", "#C9A77C", "#DCC7A6"
]);
// Hover and pressed shades of the primary: allowed in globals.css only.
const HOVER_SHADES = new Set(["#744B19", "#5E3D14"]);
// The developer feedback overlay is a dev-only tool, not an owner screen.
const SKIP = [`components${sep}dev-feedback${sep}`];
const RAW_TAILWIND = /\b(?:bg|text|border|ring|shadow|from|to|fill|stroke)-(?:red|green|blue|indigo|emerald|amber|yellow|orange|purple|pink|sky|teal|cyan|lime|rose|violet|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

describe("colour guard", () => {
  it("screens use only the palette", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const file of [...tsxFiles(join(root, "app")), ...tsxFiles(join(root, "components"))]) {
      const rel = relative(root, file);
      if (SKIP.some(s => rel.includes(s))) continue;
      const src = readFileSync(file, "utf8");
      // Neutral black/white rgba is allowed for shadows
      for (const color of src.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba?\(\s*\d[^)]*\)/g) ?? []) {
        if (color.startsWith("#")) {
          if (!ALLOWED_HEX.has(color.toUpperCase())) offenders.push(`${rel}: ${color}`);
        } else {
          const [r, g, b] = (color.match(/\d+/g) || []).map(Number);
          if (!(r === 0 && g === 0 && b === 0) && !(r === 255 && g === 255 && b === 255)) {
            offenders.push(`${rel}: ${color}`);
          }
        }
      }
      for (const cls of src.match(RAW_TAILWIND) ?? []) offenders.push(`${rel}: ${cls}`);
    }
    expect(offenders).toEqual([]);
  });

  it("globals.css defines only palette values", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const bad = (rootBlock.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).filter(h => !ALLOWED_HEX.has(h.toUpperCase()) && !HOVER_SHADES.has(h.toUpperCase()));
    expect(bad).toEqual([]);
  });

  it("brand-brown backgrounds use text-on-primary, not text-white", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    const bgPrimaryRe = /(?<![\w-])bg-primary(?![\w/-])/;
    const textWhiteRe = /(?<![\w-])text-white(?![\w/-])/;

    for (const file of [...tsxFiles(join(root, "app")), ...tsxFiles(join(root, "components"))]) {
      const rel = relative(root, file);
      if (SKIP.some(s => rel.includes(s))) continue;
      const relPath = rel.replace(/\\/g, "/");
      const src = readFileSync(file, "utf8");

      const doubleQuotes = src.match(/"(?:[^"\\\n\r]|\\.)*"/g) || [];
      const singleQuotes = src.match(/'(?:[^'\\\n\r]|\\.)*'/g) || [];
      const backticks = src.match(/`[\s\S]*?`/g) || [];

      const literals = [...doubleQuotes, ...singleQuotes];
      for (const bt of backticks) {
        literals.push(...bt.split("${"));
      }

      for (const lit of literals) {
        if (bgPrimaryRe.test(lit) && textWhiteRe.test(lit)) {
          offenders.push(`${relPath}: ${lit}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every palette alias used by screens compiles", async () => {
    const postcss = (await import('postcss')).default;
    const tailwind = (await import('tailwindcss')).default;
    const config = (await import('../tailwind.config')).default;
    const CLASSES = ['text-danger-active','text-warning-active','text-success-active','bg-warning-soft','border-border-hover','bg-danger/10','text-text-muted/50'];
    const result = await postcss([
      tailwind({ ...config, content: [{ raw: CLASSES.join(' ') }], corePlugins: { preflight: false } })
    ]).process('@tailwind utilities;', { from: undefined });
    for (const cls of CLASSES) {
      expect(result.css).toContain('.' + cls.replace('/', '\\/') + ' {');
    }
  });
});
