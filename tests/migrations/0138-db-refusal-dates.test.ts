import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const NEW = "0138_db_refusal_dates.sql";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8").replace(/\r\n/g, "\n");
const sql = read(NEW);
const code = sql.replace(/^--.*$/gm, "");

const FUNCTIONS = [
  "create_issue_slip_atomic", "edit_confirmed_stocktake_atomic", "save_purchase_order_atomic",
  "edit_issue_slip_atomic", "asset_disposals_guard",
];
// signature, attributes and body: from "create or replace function" to the closing $function$
const definition = (text: string, fn: string) =>
  new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\$function\\$[\\s\\S]*?\\$function\\$`, "i").exec(text)?.[0];
const full = (ts: string) => `to_char(${ts} at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS')`;
// The only differences 0138 may make: the five existing formats go to the second, and four bare values
// (the future-date refusal, the two "tính tới thời điểm" refusals, the disposal's purchase date) go through to_char.
// A date column has no time zone: it reads 00:00:00.
const fixed = (text: string) =>
  text
    .replace(/'DD\/MM\/YYYY( HH24:MI)?'/g, "'DD/MM/YYYY HH24:MI:SS'")
    .replace(/(cannot be in the future', )(p_issued_at);/, (_, a, ts) => `${a}${full(ts)};`)
    .replace(/(v_line_index, v_item_name, )(p_issued_at|v_slip\.issued_at);/, (_, a, ts) => `${a}${full(ts)};`)
    .replace(/(đến hôm nay', )v_acquired;/, (_, a) => `${a}to_char(v_acquired, 'DD/MM/YYYY HH24:MI:SS');`);

describe("0138 database refusal messages show the full date and time (BR-DATA-006)", () => {
  it("holds nothing but the function definitions: no drop, revoke, grant or trigger", () => {
    const rest = FUNCTIONS.reduce((t, fn) => t.replace(definition(t, fn)!, ""), code);
    expect(rest.replace(/[;\s]+/g, "")).toBe("");
  });

  it("no date in a refusal stops at the minute or at the day; all nine are now to the second", () => {
    expect(code).not.toMatch(/'DD\/MM\/YYYY( HH24:MI)?'/);
    expect(code.match(/'DD\/MM\/YYYY HH24:MI:SS'/g)).toHaveLength(9);
  });

  it.each(FUNCTIONS)("%s: the previous definition, with only the date changes", (fn) => {
    const previous = readdirSync(DIR).filter(f => f < NEW).sort().reverse()
      .map(f => definition(read(f), fn)).find(Boolean);
    expect(definition(sql, fn)).toBe(fixed(previous!));
  });

  it.each(FUNCTIONS)("%s: no raise feeds a bare timestamp (any *_at value) to a message placeholder", (fn) => {
    const raises = [...definition(sql, fn)!.matchAll(/raise exception '(?:[^']|'')*'([^;]*);/g)].map(m => m[1]);
    expect(raises.length).toBeGreaterThan(0);
    for (const args of raises) {
      expect(args.replace(/to_char\(.*?'DD\/MM\/YYYY HH24:MI:SS'\)/g, "")).not.toMatch(/\b[\w.]*_at\b/);
    }
  });

  it("asset_disposals_guard: the purchase date is a date, wrapped without a time zone, so 2026-03-27 reads 27/03/2026 00:00:00", () => {
    expect(definition(sql, "asset_disposals_guard")).toContain(
      "đến hôm nay', to_char(v_acquired, 'DD/MM/YYYY HH24:MI:SS');",
    );
  });
});
