import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-005 (owner 2026-10-07, spec docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md
// section 3): screens use the shared templates in components/ui instead of
// styling their own buttons, number boxes and tables. Each rule below keeps a
// list of the files still off-template. The list may only shrink: a new file
// that breaks a rule turns this red, and so does a fixed file left on the
// list. Waves K3-K6 move the screens and empty the lists.
//
// Scanned: .tsx under app/admin, app/settings and components, except
// components/ui (the templates themselves) and tests. The POS (app/pos), the
// login page and the error pages keep their own look and are not scanned.
// The number-format rule lives in lib/shared/format.guard.test.ts.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

// Comments are not screens: drop block comments and line comments (but not
// the "//" inside a URL string such as "https://").
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const root = process.cwd();
const files = ["app/admin", "app/settings", "components"]
  .flatMap(dir => sources(join(root, dir)))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: stripComments(readFileSync(f, "utf8")) }))
  .filter(f => !f.path.startsWith("components/ui/"));

function offenders(pattern: RegExp, skip: (match: string) => boolean = () => false): string[] {
  return files
    .filter(f => [...f.src.matchAll(new RegExp(pattern.source, "g"))].some(m => !skip(m[0])))
    .map(f => f.path)
    .sort();
}

// The text of every opening tag named `tag`, read to its real end: a ">" inside
// {...} (an arrow function "=>", a comparison) or inside a quoted attribute does
// not end the tag. A plain [^>]* stopped at the "=>" of onClick={() => ...} and
// missed the className after it (K2 review).
function openingTags(src: string, tag: string): string[] {
  const tags: string[] = [];
  const start = new RegExp(`<${tag}\\b`, "g");
  for (const m of src.matchAll(start)) {
    let depth = 0;
    let quote = "";
    let i = m.index! + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth === 0 && (c === '"' || c === "'")) quote = c;
      else if (depth === 0 && c === ">") break;
    }
    tags.push(src.slice(m.index!, i + 1));
  }
  return tags;
}

function tagOffenders(tagNames: string[], pattern: RegExp): string[] {
  return files
    .filter(f => tagNames.some(t => openingTags(f.src, t).some(text => pattern.test(text))))
    .map(f => f.path)
    .sort();
}

// Waves (spec section 4): K3 Kho, K4 Bán hàng, K5 Tài chính và báo cáo, K6 còn lại.

const NUMBER_TYPE_DEBT: string[] = [
];

const SOLID_BUTTON_DEBT: string[] = [
];

const TABLE_DEBT: string[] = [
];

const BOLD_CELL_DEBT: string[] = [
];

const ENGLISH_BRACKET_DEBT: string[] = [
];

const RAW_INPUT_DEBT: string[] = [
];

const RAW_SELECT_DEBT: string[] = [
];

const NUMERIC_INPUTMODE_DEBT: string[] = [
];

const RAW_H1_DEBT: string[] = [
];

// Names and units that are fine in brackets: brand names and abbreviations
// the owner keeps (spec 2.6), and units of measure.
const BRACKET_ALLOWED = new Set(["Topping", "MR.PHIN", "PO", "ml", "g", "kg"]);

describe("BR-UI-005 screens use the shared templates (lists may only shrink)", () => {
  it('no number box is type="number": use NumberInput or MoneyInput', () => {
    expect(offenders(/type=["{]?["']?number/)).toEqual([...NUMBER_TYPE_DEBT].sort());
  });

  it("no screen paints its own solid brown or red button or link: use Button", () => {
    expect(tagOffenders(["button", "Link", "a"], /\bbg-(primary|danger)(?![-\w/])/)).toEqual(
      [...SOLID_BUTTON_DEBT].sort(),
    );
  });

  it("no screen draws its own <table>: use the Table set or DataList", () => {
    expect(offenders(/<table\b/)).toEqual([...TABLE_DEBT].sort());
  });

  it("no table cell is bold: every row cell has the same weight (BR-UI-003)", () => {
    expect(tagOffenders(["td"], /\bfont-(bold|semibold|medium)\b/)).toEqual([...BOLD_CELL_DEBT].sort());
  });

  // spec 2.3: text boxes, selects and date boxes come from components/ui.
  it("no screen styles its own text box: use TextInput, NumberInput, DayInput or SaigonDateTimeInput", () => {
    expect(
      tagOffenders(["input"], /^(?![\s\S]*\btype=["{]?["'`]?(hidden|checkbox|radio|file)\b)/),
    ).toEqual([...RAW_INPUT_DEBT].sort());
  });

  it("no screen styles its own select: use Select or SearchableSelect", () => {
    expect(offenders(/<select\b/)).toEqual([...RAW_SELECT_DEBT].sort());
  });

  // spec 2.2: one number box. A hand-filtered inputMode box is a number box built by hand.
  it("no screen builds its own number box with inputMode: use NumberInput or MoneyInput", () => {
    expect(offenders(/\binputMode=["{]?["'`]?(numeric|decimal)/)).toEqual([...NUMERIC_INPUTMODE_DEBT].sort());
  });

  // spec 2.6: page titles come from ListPageHeader, DetailHeader or PageHeader.
  it("no screen writes its own <h1>: use ListPageHeader, DetailHeader or PageHeader", () => {
    expect(offenders(/<h1\b/)).toEqual([...RAW_H1_DEBT].sort());
  });

  it("no label puts English in brackets after Vietnamese (BR-UI-001)", () => {
    const found = offenders(/[À-ỹ][^"'`<>{}\n]*\(\s*[A-Za-z][A-Za-z. ]*[A-Za-z]\s*\)/, match => {
      const inner = match.slice(match.lastIndexOf("(") + 1, -1).trim();
      return BRACKET_ALLOWED.has(inner);
    });
    expect(found).toEqual([...ENGLISH_BRACKET_DEBT].sort());
  });
});
