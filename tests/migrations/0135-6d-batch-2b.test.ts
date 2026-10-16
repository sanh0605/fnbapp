import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(`supabase/migrations/${f}`, "utf8").replace(/\r\n/g, "\n");
const sql = read("0135_6d_batch_2b.sql");
const old = read("0127_order_promotions.sql");
const code = sql.replace(/^--.*$/gm, "");

const GONE = ["completed_at", "pos_snapshot_json"];
const FUNCTIONS = ["create_pos_order_atomic_unvalidated_0025", "supersede_order_v2_atomic"];

const topLevelCount = (list: string) => {
  let depth = 0, n = 1;
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) n++;
  }
  return n;
};
// the column list and the values list of the one orders_v2 insert inside a function body
const orderInsert = (body: string) => {
  const m = /insert into public\.orders_v2 \(([^)]*)\)\s*values \(([\s\S]*?)\n  \);/.exec(body)!;
  return { columns: m[1], values: m[2] };
};
const signature = (text: string, fn: string) => new RegExp(`create or replace function public\\.${fn}\\([^)]*\\)\\s*RETURNS \\w+`).exec(text)![0];
const body = (fn: string) => code.slice(code.indexOf(`public.${fn}(`)).split("$function$;")[0];

describe("0135 6d batch 2b", () => {
  it.each(FUNCTIONS)("%s: same signature as 0127, insert has neither dropped column", (fn) => {
    expect(signature(sql, fn)).toBe(signature(old, fn));
    const { columns, values } = orderInsert(body(fn));
    for (const c of GONE) {
      expect(columns).not.toContain(c);
      expect(values).not.toContain(c);
    }
    expect(topLevelCount(values)).toBe(columns.split(",").length);
  });

  it("drops exactly the two columns", () => {
    expect(code.replace(/\s+/g, " ")).toContain("alter table public.orders_v2 drop column completed_at, drop column pos_snapshot_json;");
    expect(code.match(/\bdrop\b/gi)).toHaveLength(2);
  });

  it("sets lock_timeout before the first statement and resets it at the end", () => {
    expect(sql.indexOf("set lock_timeout = '3s';")).toBeGreaterThan(-1);
    expect(sql.indexOf("set lock_timeout = '3s';")).toBeLessThan(sql.indexOf("create or replace"));
    expect(sql.lastIndexOf("reset lock_timeout;")).toBeGreaterThan(sql.lastIndexOf("drop column"));
  });
});
