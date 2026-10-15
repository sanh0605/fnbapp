// tests/migrations/purchased-item-save-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const m = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0124_save_purchased_item_atomic.sql"),
  "utf8",
).toLowerCase();

describe("0124: saving an item is one transaction", () => {
  it("is service_role only and says it is not run yet", () => {
    const sig = "public.save_purchased_item_atomic(text, text, text, boolean, boolean, text, text, jsonb, text[])";
    expect(m).toContain("not yet run");
    for (const role of ["public", "anon", "authenticated"]) {
      expect(m).toContain(`revoke all on function ${sig} from ${role}`);
    }
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
    expect(m).toContain("set search_path to 'public'");
  });

  it("writes the item, the asset retirement and the conversions inside the one function", () => {
    expect(m).toContain("insert into public.purchased_items");
    expect(m).toContain("update public.purchased_items");
    expect(m).toContain("update public.assets set status = 'inactive'");
    expect(m).toContain("insert into public.uom_conversions");
    expect(m).toContain("update public.uom_conversions");
    expect(m).toContain("delete from public.uom_conversions");
  });

  it("mints ids as highest suffix + 1 under a lock, like generateNewId", () => {
    expect(m).toContain("pg_advisory_xact_lock");
    expect(m).toContain("'spm-' || lpad(");
    expect(m).toContain("'qd-' || lpad(");
  });

  it("retires a conversion a purchase line points to and deletes any other removed one", () => {
    expect(m).toContain("purchase_order_lines l where l.conversion_id = c.id");
    expect(m).toContain("update public.uom_conversions set status = 'inactive'");
  });

  it("refuses a duplicate name and a missing item in Vietnamese", () => {
    expect(m).toContain("when unique_violation");
    expect(m).toContain("đã có hàng hoá đang dùng tên");
    expect(m).toContain("không tìm thấy hàng hoá.");
  });
});
