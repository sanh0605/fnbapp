import { describe, it, expect } from "vitest";
import { extractTables } from "./extract-tables";

describe("extractTables", () => {
  it("reads table name, columns, and a status check-enum", () => {
    const sql = `
      create table if not exists public.products (
        id text primary key,
        name text not null,
        status text not null default 'ACTIVE'
          check (status in ('ACTIVE','INACTIVE','DELETED'))
      );`;
    expect(extractTables([sql])).toEqual([
      { name: "products", columns: ["id", "name", "status"], statusValues: ["ACTIVE", "INACTIVE", "DELETED"] },
    ]);
  });

  it("merges columns added by a later alter table", () => {
    const create = `create table public.assets ( id text primary key );`;
    const alter = `alter table public.assets add column note text;`;
    expect(extractTables([create, alter])[0].columns).toEqual(["id", "note"]);
  });
});
