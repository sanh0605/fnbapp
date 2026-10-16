import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8").replace(/\r\n/g, "\n");
const sql = read("0136_6d_batch_2c.sql");
const code = sql.replace(/^--.*$/gm, "");

const FUNCTIONS = [
  "open_stocktake_session_atomic", "apply_stocktake_session_atomic", "edit_confirmed_stocktake_atomic",
  "save_stocktake_line_atomic", "create_issue_slip_atomic", "edit_issue_slip_atomic",
];
const signature = (text: string, fn: string) =>
  new RegExp(`create or replace function public\\.${fn}\\([^)]*\\)\\s*RETURNS \\w+`, "i").exec(text)?.[0].toLowerCase();
// the newest earlier migration that defines the function is the one 0136 must stay compatible with
const previous = (fn: string) => {
  const files = readdirSync(DIR).filter(f => f < "0136").sort().reverse();
  return read(files.find(f => signature(read(f), fn))!);
};
const body = (fn: string) => code.slice(code.indexOf(`public.${fn}(`)).split("$function$;")[0];

describe("0136 6d batch 2c", () => {
  it.each(FUNCTIONS)("%s: same signature as the previous definition", (fn) => {
    expect(signature(sql, fn)).toBeDefined();
    expect(signature(sql, fn)).toBe(signature(previous(fn), fn));
  });

  it.each(FUNCTIONS)("%s: names none of the three dropped columns", (fn) => {
    const b = body(fn);
    expect(b).not.toMatch(/\bitem_type\b/);
    expect(b).not.toMatch(/\bnotes\b/); // p_notes is a different word
    expect(b).not.toMatch(/v_slip\.note\b/);
    expect(b).not.toMatch(/insert into public\.issue_slips \([^)]*\bnote\b/);
  });

  it("no body keeps the dead item-type branches", () => {
    expect(code).not.toMatch(/BASE_INGREDIENT|SEMI_PRODUCT/);
  });

  it("create_issue_slip_atomic still returns the note key, as empty text", () => {
    expect(body("create_issue_slip_atomic")).toContain("'note', ''");
  });

  it("drops exactly the three columns", () => {
    const flat = code.replace(/\s+/g, " ");
    expect(flat).toContain("alter table public.issue_slips drop column note;");
    expect(flat).toContain("alter table public.stocktake_sessions drop column notes;");
    expect(flat).toContain("alter table public.stocktake_lines drop column item_type;");
    expect(code.match(/\bdrop\b/gi)).toHaveLength(3);
  });

  it("adds no foreign key", () => {
    expect(code).not.toMatch(/foreign key|references/i);
  });

  it("sets lock_timeout before the first statement and resets it at the end", () => {
    expect(sql.indexOf("set lock_timeout = '3s';")).toBeGreaterThan(-1);
    expect(sql.indexOf("set lock_timeout = '3s';")).toBeLessThan(sql.indexOf("create or replace"));
    expect(sql.lastIndexOf("reset lock_timeout;")).toBeGreaterThan(sql.lastIndexOf("drop column"));
  });
});
