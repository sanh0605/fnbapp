export type TableInfo = { name: string; columns: string[]; statusValues: string[] };

const CREATE = /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*;/gi;
const ALTER = /alter table (?:if exists )?(?:public\.)?(\w+)\s+add column\s+(?:if not exists\s+)?(\w+)/gi;
const STATUS_ENUM = /status\s+in\s*\(([^)]*)\)/i;
const COLUMN_HEAD = /^([a-z_][a-z0-9_]*)\s+/i;

// Words that begin a table constraint, not a column definition.
const NON_COLUMN = new Set(["primary", "foreign", "unique", "check", "constraint"]);

export function extractTables(sqlSources: string[]): TableInfo[] {
  const byName = new Map<string, TableInfo>();
  const get = (name: string) =>
    byName.get(name) ?? byName.set(name, { name, columns: [], statusValues: [] }).get(name)!;

  for (const sql of sqlSources) {
    for (const m of sql.matchAll(CREATE)) {
      const table = get(m[1]);
      const enumMatch = STATUS_ENUM.exec(m[2]);
      if (enumMatch) {
        table.statusValues = enumMatch[1].split(",").map(s => s.trim().replace(/^'|'$/g, ""));
      }
      for (const rawLine of m[2].split("\n")) {
        const line = rawLine.trim();
        const head = COLUMN_HEAD.exec(line);
        if (!head || NON_COLUMN.has(head[1].toLowerCase())) continue;
        if (!table.columns.includes(head[1])) table.columns.push(head[1]);
      }
    }
    for (const m of sql.matchAll(ALTER)) {
      const table = get(m[1]);
      if (!table.columns.includes(m[2])) table.columns.push(m[2]);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
