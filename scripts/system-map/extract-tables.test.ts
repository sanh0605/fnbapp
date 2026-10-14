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

  it("takes every add column clause of one alter table", () => {
    const create = `create table public.modifiers ( id text primary key );`;
    const alter = `alter table public.modifiers
      add column if not exists group_id text,
      add column if not exists is_default boolean not null default false,
      add column if not exists max_qty int;`;
    expect(extractTables([create, alter])[0].columns).toEqual(["id", "group_id", "is_default", "max_qty"]);
  });

  it("drops a table removed by a later DROP TABLE", () => {
    const sources = [
      "create table public.a (id text);",
      "create table public.b (id text);",
      "drop table public.a;",
    ];
    expect(extractTables(sources).map(t => t.name)).toEqual(["b"]);
  });

  it("keeps a table that is dropped then re-created later", () => {
    const sources = [
      "create table public.a (id text);",
      "drop table public.a;",
      `create table public.a (
        id text,
        name text
      );`,
    ];
    expect(extractTables(sources).map(t => t.name)).toEqual(["a"]);
    expect(extractTables(sources)[0].columns).toEqual(["id", "name"]);
  });
});
