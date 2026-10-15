import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Whole-line comments stripped (a string like ' -- ' must survive) so a note that names lpad or a constraint cannot satisfy a check.
const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0132_6d_batch_1a.sql"), "utf8")
  .replace(/^\s*--[^\n]*/gm, "")
  .toLowerCase();

function functionBlock(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`0132 does not redefine ${name}`);
  const end = sql.indexOf("$function$", sql.indexOf("$function$", start) + 1);
  return sql.slice(start, end);
}

// Top-level comma split: quotes and brackets keep their commas.
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0, quoted = false, current = "";
  for (const ch of text) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && (ch === "(" || ch === "[")) depth++;
    if (!quoted && (ch === ")" || ch === "]")) depth--;
    if (!quoted && depth === 0 && ch === ",") { parts.push(current.trim()); current = ""; } else current += ch;
  }
  return [...parts, current.trim()];
}

describe("0132: dead objects", () => {
  it("drops get_my_role, the duplicate users index and the plain reversal index the unique one replaces, nothing else", () => {
    expect(sql).toContain("drop function if exists public.get_my_role();");
    expect(sql).toContain("drop index if exists public.idx_users_username;");
    expect(sql).not.toContain("users_username_key");
    expect((sql.match(/\bdrop (function|index|table|column)/g) ?? []).length).toBe(3);
  });
});

describe("0132: constraints with 0 violations", () => {
  const expected: Record<string, RegExp> = {
    "conversion rate": /alter table public\.uom_conversions\s+add constraint uom_conversions_rate_positive check \(conversion_rate > 0\)/,
    "purchase line money": /add constraint purchase_order_lines_money_not_negative check \(\s*subtotal >= 0 and unit_price >= 0 and base_quantity >= 0\s*\)/,
    "stock issue session": /add constraint stock_issues_session_matches_source check \(\(source = 'stocktake'\) = \(session_id is not null\)\)/,
    "stock issue manual link": /add constraint stock_issues_manual_one_link check \(\s*source <> 'manual' or \(\(issue_slip_id is not null\)::int \+ \(reverses_issue_id is not null\)::int\) = 1\s*\)/,
    "stock issue one reversal": /create unique index ux_stock_issues_reverses on public\.stock_issues \(reverses_issue_id\)\s+where reverses_issue_id is not null/,
    "asset quantity": /assets_quantity_positive check \(quantity > 0\)/,
    "asset term": /assets_term_positive check \(term_months > 0\)/,
    "asset costs": /assets_costs_not_negative check \(unit_cost >= 0 and total_cost >= 0\)/,
    "band unique": /asset_depreciation_bands_min_unique unique \(min_unit_price\) deferrable initially deferred/,
    "band min": /asset_depreciation_bands_min_not_negative check \(min_unit_price >= 0\)/,
    "product category": /alter table public\.products\s+alter column category_id set not null/,
    "dish group name": /create unique index ux_product_categories_active_name on public\.product_categories \([^;]*where status = 'active'/,
    "variant price": /product_variants_price_not_negative check \(price >= 0\)/,
    "modifier price": /modifiers_price_not_negative check \(price >= 0\)/,
    "promotion dates": /promotions_dates_ordered check \(end_date is null or start_date is null or end_date >= start_date\)/,
    "promotion value": /promotions_value_valid check \(\s*discount_value >= 0 and \(discount_type <> 'percent' or discount_value <= 100\)\s*\)/,
    "promotion min": /promotions_min_order_not_negative check \(min_order_value >= 0\)/,
    "promotion bigint": /alter column min_order_value type bigint using min_order_value::bigint/,
  };
  for (const [name, pattern] of Object.entries(expected)) {
    it(`adds ${name}`, () => expect(sql).toMatch(pattern));
  }

  it("makes every added constraint re-runnable", () => {
    const adds = (sql.match(/add constraint (\w+)/g) ?? []).map(m => m.split(" ")[2]);
    expect(adds.length).toBeGreaterThanOrEqual(14);
    for (const name of adds) expect(sql).toContain(`drop constraint if exists ${name}`);
  });
});

describe("0132: guards that look at other tables", () => {
  it("asset_disposals_guard also refuses a date before the purchase or after today in Vietnam", () => {
    const body = functionBlock("asset_disposals_guard");
    expect(body).toContain("acquired_date");
    expect(body).toContain("(now() at time zone 'asia/ho_chi_minh')::date");
    expect(body).toMatch(/new\.disposed_date < v_acquired[\s\S]*raise exception '[^']*[^\x00-\x7f]/);
    expect(body).toContain("vượt quá số lượng còn lại"); // the two old refusals stay
  });

  it("a monthly expense item must sit in an EXPENSE category, checked by a trigger", () => {
    const body = functionBlock("monthly_expense_items_category_guard");
    expect(body).toContain("kind <> 'expense'");
    expect(sql).toMatch(
      /create trigger monthly_expense_items_category_guard before insert or update of cash_category_id on public\.monthly_expense_items\s+for each row execute function public\.monthly_expense_items_category_guard\(\)/,
    );
    expect(sql).toContain("revoke all on function public.monthly_expense_items_category_guard() from public;");
  });
});

describe("0132: orders_v2 and promotions are altered under a lock timeout", () => {
  it("sets lock_timeout before the first ALTER on either table", () => {
    const lock = sql.indexOf("set lock_timeout");
    expect(lock).toBeGreaterThanOrEqual(0);
    for (const table of ["orders_v2", "promotions"]) {
      expect(sql.indexOf(`alter table public.${table}`)).toBeGreaterThan(lock);
    }
  });

  it("drops the empty-string defaults of the three link columns the till names itself, and no other", () => {
    for (const col of ["parent_order_id", "superseded_by", "applied_promotion_id"]) {
      expect(sql).toMatch(new RegExp(`alter column ${col} drop default`));
    }
    expect((sql.match(/drop default/g) ?? []).length).toBe(3);
  });
});

describe("0132: save_product_atomic takes old_price from the size's real price", () => {
  it("writes v_old_price, not the last history row", () => {
    const body = functionBlock("save_product_atomic");
    expect(body).not.toContain("v_history_old_price");
    expect(body).toMatch(/new_price, effective_at, created_at\s*\) values \(\s*'pph-' \|\| [^;]*?v_variant_id,\s*v_old_price,\s*v_new_price/);
  });
});

// K-12: lpad cuts to its width, so id 1000 became "100" and collided with id 100.
const MINTING_FUNCTIONS = [
  "apply_stocktake_session_atomic",
  "create_issue_slip_atomic",
  "create_standalone_topping_product_atomic",
  "edit_confirmed_stocktake_atomic",
  "edit_issue_slip_atomic",
  "open_stocktake_session_atomic",
  "replace_asset_depreciation_bands",
  "reverse_manual_issue_atomic",
  "reverse_stocktake_session_atomic",
  "save_product_atomic",
  "save_purchase_order_atomic",
  "save_purchased_item_atomic",
  "sync_topping_price_atomic",
];

describe("0132: ids are never cut (K-12)", () => {
  it.each(MINTING_FUNCTIONS)("%s mints without lpad", name => {
    const body = functionBlock(name);
    expect(body).not.toContain("lpad(");
    expect(body).toMatch(/repeat\('0', greatest\(\d - length\(\w+::text\), 0\)\)/);
  });

  it("padding to a width keeps 999 and 1000 apart where lpad made 1000 equal 100", () => {
    const mint = (n: number, width: number) => "0".repeat(Math.max(width - String(n).length, 0)) + n;
    const lpad = (n: number, width: number) => String(n).padStart(width, "0").slice(0, width);
    expect(mint(999, 3)).toBe("999");
    expect(mint(1000, 3)).toBe("1000");
    expect(mint(7, 3)).toBe("007");
    expect(lpad(1000, 3)).toBe(lpad(100, 3));
    expect(mint(1000, 3)).not.toBe(mint(100, 3));
  });

  it("does not touch the till or the order edit and void functions", () => {
    for (const name of ["create_pos_order_atomic", "supersede_order_v2_atomic", "void_order_atomic"]) {
      expect(sql).not.toContain(`function public.${name}`);
    }
  });
});

// K-11: every function that inserts into stock_issues must satisfy the new rules.
describe("0132: every stock_issues writer satisfies the new rules", () => {
  const writers = [
    "apply_stocktake_session_atomic",
    "create_issue_slip_atomic",
    "edit_confirmed_stocktake_atomic",
    "edit_issue_slip_atomic",
    "reverse_manual_issue_atomic",
    "reverse_stocktake_session_atomic",
  ];

  const inserts = (name: string) =>
    [...functionBlock(name).matchAll(/insert into public\.stock_issues\s*\(([^)]*)\)\s*values\s*\(([\s\S]*?)\);/g)].map(m => {
      const columns = splitTop(m[1]);
      const values = splitTop(m[2]);
      return Object.fromEntries(columns.map((c, i) => [c, values[i]]));
    });

  it.each(writers)("%s", name => {
    const rows = inserts(name);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const source = row.source.replace(/'/g, "");
      expect(["stocktake", "manual"]).toContain(source);
      const hasSession = row.session_id !== undefined && row.session_id !== "null";
      expect(hasSession).toBe(source === "stocktake");
      if (source === "manual") {
        const links = Number(row.issue_slip_id !== undefined) + Number(row.reverses_issue_id !== undefined);
        expect(links).toBe(1);
      }
    }
  });

  it("covers all six functions that write the table", () => {
    const all = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map(m => m[1]);
    const writing = all.filter(n => /insert into public\.stock_issues/.test(functionBlock(n)));
    expect(writing.sort()).toEqual([...writers].sort());
  });
});
