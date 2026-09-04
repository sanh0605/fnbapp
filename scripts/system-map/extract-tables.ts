export type TableInfo = { name: string; columns: string[]; statusValues: string[] };

const CREATE = /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*;/gi;
const ALTER = /alter table (?:if exists )?(?:public\.)?(\w+)\s+add column\s+(?:if not exists\s+)?(\w+)/gi;
const DROP = /drop table (?:if exists )?(?:public\.)?(\w+)/gi;
const STATUS_ENUM = /status\s+in\s*\(([^)]*)\)/i;
const COLUMN_HEAD = /^([a-z_][a-z0-9_]*)\s+/i;

// Words that begin a table constraint, not a column definition.
const NON_COLUMN = new Set(["primary", "foreign", "unique", "check", "constraint"]);

type TableEvent =
  | { kind: "create"; name: string; body: string; pos: number }
  | { kind: "alter"; name: string; column: string; pos: number }
  | { kind: "drop"; name: string; pos: number };

export function extractTables(sqlSources: string[]): TableInfo[] {
  const byName = new Map<string, TableInfo>();
  const get = (name: string) =>
    byName.get(name) ?? byName.set(name, { name, columns: [], statusValues: [] }).get(name)!;

  for (const sql of sqlSources) {
    // Process CREATE / ALTER / DROP in source order so a DROP TABLE removes a
    // table added earlier in the same migration set, and a later CREATE for
    // the same name (after a DROP) starts from a clean slate.
    const events: TableEvent[] = [];
    for (const m of sql.matchAll(CREATE)) events.push({ kind: "create", name: m[1], body: m[2], pos: m.index! });
    for (const m of sql.matchAll(ALTER)) events.push({ kind: "alter", name: m[1], column: m[2], pos: m.index! });
    for (const m of sql.matchAll(DROP)) events.push({ kind: "drop", name: m[1], pos: m.index! });
    events.sort((a, b) => a.pos - b.pos);

    for (const event of events) {
      if (event.kind === "drop") {
        byName.delete(event.name);
        continue;
      }
      if (event.kind === "create") {
        const table = get(event.name);
        const enumMatch = STATUS_ENUM.exec(event.body);
        if (enumMatch) {
          table.statusValues = enumMatch[1].split(",").map(s => s.trim().replace(/^'|'$/g, ""));
        }
        for (const rawLine of event.body.split("\n")) {
          const line = rawLine.trim();
          const head = COLUMN_HEAD.exec(line);
          if (!head || NON_COLUMN.has(head[1].toLowerCase())) continue;
          if (!table.columns.includes(head[1])) table.columns.push(head[1]);
        }
        continue;
      }
      const table = get(event.name);
      if (!table.columns.includes(event.column)) table.columns.push(event.column);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
