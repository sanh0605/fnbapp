import { describe, expect, it } from "vitest";
import { buildSeedSql } from "./seed-sweetness-ice-groups-core";

describe("buildSeedSql", () => {
  it("ends with rollback; without apply and commit; with apply", () => {
    expect(buildSeedSql(false, []).trim()).toMatch(/rollback;$/);
    expect(buildSeedSql(false, []).trim()).not.toMatch(/commit;/);
    expect(buildSeedSql(true, []).trim()).toMatch(/commit;$/);
    expect(buildSeedSql(true, []).trim()).not.toMatch(/rollback;/);
  });
  it("takes both advisory locks", () => {
    const sql = buildSeedSql(false, []);
    expect(sql).toContain("hashtext('modifier_groups:id')");
    expect(sql).toContain("hashtext('modifiers:id')");
  });
  it("names both groups and all 7 options", () => {
    const sql = buildSeedSql(false, []);
    for (const n of ["Độ ngọt", "Đá", "Bình thường", "Ít ngọt", "Không đường", "Ít đá", "Không đá", "Đá riêng"]) expect(sql).toContain(`'${n}'`);
  });
  it("computes ids in SQL, never hardcoding the next ones", () => {
    const sql = buildSeedSql(false, []);
    expect(sql).not.toContain("MG-002");
    expect(sql).not.toContain("MOD-011");
  });
  it("filters excluded names with escaped quotes, and has no filter when none", () => {
    expect(buildSeedSql(false, ["Bánh d'or", "Trà"])).toContain("not in ('Bánh d''or', 'Trà')");
    expect(buildSeedSql(false, [])).not.toContain("not in (");
  });
  it("counts links of every group before and after", () => {
    const sql = buildSeedSql(false, []);
    expect(sql).toContain("(select count(*) from public.modifier_group_products) as links");
    expect(sql).toContain("'links', (select count(*) from public.modifier_group_products)");
    expect(sql).toContain("'new_group_links'");
  });
  it("aborts the transaction when a new group's dish count differs from MG-001 minus exclusions", () => {
    const sql = buildSeedSql(false, ["Trà"]);
    expect(sql).toContain("raise exception");
    expect(sql.indexOf("raise exception")).toBeLessThan(sql.indexOf("rollback;"));
    expect(sql.slice(sql.indexOf("raise exception") - 900, sql.indexOf("raise exception"))).toContain("not in ('Trà')");
  });
});
