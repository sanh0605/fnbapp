// Reads and writes UI-FEEDBACK.md's plain-text format.
// section 7.
//
// Pure string functions only -- the API route (app/api/dev-feedback/
// route.ts) does the actual file I/O and the dev-only gate; this file only
// knows the text shape, so it is directly testable without touching disk.

export interface FeedbackEntry {
  id: string;
  createdAt: string; // ISO timestamp
  route: string;
  viewportWidth: number;
  // Null for a general comment with no element attached (plan section 2).
  selector: string | null;
  className: string | null;
  textSnippet: string | null;
  sourceFile: string | null;
  sourceLine: number | null;
  sourceColumn: number | null;
  note: string;
}

const HEADER =
  '# Góp ý giao diện\n\n<!-- Tệp này do công cụ "Góp ý" tạo và cập nhật tự động. Không commit -- xem .gitignore. -->\n';

function formatEntry(e: FeedbackEntry): string {
  const lines = [`## [${e.createdAt}] id-${e.id}`, `- Route: ${e.route}`, `- Viewport: ${e.viewportWidth}px`];
  if (e.selector) lines.push(`- Selector: ${e.selector}`);
  if (e.className) lines.push(`- Class: ${e.className}`);
  if (e.textSnippet) lines.push(`- Text: "${e.textSnippet}"`);
  if (e.sourceFile) lines.push(`- Nguồn: ${e.sourceFile}:${e.sourceLine}:${e.sourceColumn}`);
  lines.push("", `Ghi chú: ${e.note}`, "", "---", "");
  return lines.join("\n");
}

// Newest last (plan section 7), so the slash command and a human scanning
// top-down both see the most recent comment at the end.
export function serializeFeedback(entries: FeedbackEntry[]): string {
  if (entries.length === 0) return HEADER;
  return HEADER + "\n" + entries.map(formatEntry).join("\n");
}

const ENTRY_PATTERN = /## \[(.+?)\] id-([a-zA-Z0-9-]+)\n([\s\S]*?)\n\nGhi chú: ([\s\S]*?)\n\n---/g;
// \w is ASCII-only in JS, so it cannot capture "Nguồn" -- named explicitly.
const META_LINE = /^- (Route|Viewport|Selector|Class|Text|Nguồn): (.*)$/;

export function parseFeedback(content: string): FeedbackEntry[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const entries: FeedbackEntry[] = [];

  for (const match of normalized.matchAll(ENTRY_PATTERN)) {
    const [, createdAt, id, metaBlock, note] = match;
    const meta: Record<string, string> = {};
    for (const line of metaBlock.split("\n")) {
      const m = META_LINE.exec(line.trim());
      if (m) meta[m[1]] = m[2];
    }

    let sourceFile: string | null = null;
    let sourceLine: number | null = null;
    let sourceColumn: number | null = null;
    const source = meta["Nguồn"];
    if (source) {
      const sm = /^(.*):(\d+):(\d+)$/.exec(source);
      if (sm) {
        sourceFile = sm[1];
        sourceLine = Number(sm[2]);
        sourceColumn = Number(sm[3]);
      }
    }

    entries.push({
      id,
      createdAt,
      route: meta["Route"] || "",
      viewportWidth: Number((meta["Viewport"] || "0px").replace("px", "")),
      selector: meta["Selector"] || null,
      className: meta["Class"] || null,
      textSnippet: meta["Text"] ? meta["Text"].replace(/^"|"$/g, "") : null,
      sourceFile,
      sourceLine,
      sourceColumn,
      note,
    });
  }

  return entries;
}

export function appendEntry(content: string, entry: FeedbackEntry): string {
  return serializeFeedback([...parseFeedback(content), entry]);
}

// Empties the queue only for the entry actually removed (plan section 7) --
// every other entry round-trips unchanged.
export function removeEntry(content: string, id: string): string {
  return serializeFeedback(parseFeedback(content).filter(e => e.id !== id));
}

export function emptyFeedbackFile(): string {
  return HEADER;
}
