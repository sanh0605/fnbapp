export type SheetReferenceKind = "helper" | "range";

export type SheetReference = {
  sheetName: string;
  filePath: string;
  line: number;
  kind: SheetReferenceKind;
};

export type SheetMeta = {
  title: string;
  rowCount: number;
  columnCount: number;
};

export type SheetClassification = SheetMeta & {
  status: "KEEP" | "ARCHIVE_CANDIDATE" | "REVIEW";
  reason: string;
  references: SheetReference[];
};

const HELPER_CALL_RE = /\b(?:findAll|findAllNoCache|getHeaders|getHeadersNoCache|insert|insertMany|update|remove|removeMany|generateNewId)\(\s*["']([^"']+)["']/g;
const RANGE_RE = /["'`]([A-Za-z0-9_ À-ỹ.\-]+)!/g;

export function extractSheetReferences(filePath: string, source: string): SheetReference[] {
  const refs: SheetReference[] = [];
  collectRefs(refs, HELPER_CALL_RE, source, filePath, "helper");
  collectRefs(refs, RANGE_RE, source, filePath, "range");
  return dedupeRefs(refs);
}

export function classifySheets(input: {
  sheets: SheetMeta[];
  references: SheetReference[];
}): SheetClassification[] {
  const refsByCanonical = new Map<string, SheetReference[]>();
  for (const ref of input.references) {
    const rows = refsByCanonical.get(canonical(ref.sheetName)) || [];
    rows.push(ref);
    refsByCanonical.set(canonical(ref.sheetName), rows);
  }

  const titlesByCanonical = new Map<string, string[]>();
  for (const sheet of input.sheets) {
    const rows = titlesByCanonical.get(canonical(sheet.title)) || [];
    rows.push(sheet.title);
    titlesByCanonical.set(canonical(sheet.title), rows);
  }

  return input.sheets.map(sheet => {
    const refs = refsByCanonical.get(canonical(sheet.title)) || [];
    if (refs.some(ref => ref.sheetName === sheet.title)) {
      return {
        ...sheet,
        status: "KEEP" as const,
        reason: "Referenced by code with exact sheet name.",
        references: refs.filter(ref => ref.sheetName === sheet.title),
      };
    }

    if (refs.length > 0) {
      return {
        ...sheet,
        status: "KEEP" as const,
        reason: "Referenced by code through a case/style variant; Google Sheets ranges are serving this tab.",
        references: refs,
      };
    }

    const variants = titlesByCanonical.get(canonical(sheet.title)) || [];
    if (variants.length > 1 && sheet.title !== preferredTitle(variants)) {
      return {
        ...sheet,
        status: "ARCHIVE_CANDIDATE" as const,
        reason: "Duplicate by normalized title and not the preferred title.",
        references: [],
      };
    }

    if (looksLikeBackupOrLegacy(sheet.title)) {
      return {
        ...sheet,
        status: "ARCHIVE_CANDIDATE" as const,
        reason: "Name looks like backup/legacy/copy sheet and no direct code reference was found.",
        references: [],
      };
    }

    return {
      ...sheet,
      status: "REVIEW" as const,
      reason: "No direct code reference found; inspect manually before archive/delete.",
      references: [],
    };
  }).sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.title.localeCompare(b.title));
}

function collectRefs(
  refs: SheetReference[],
  regex: RegExp,
  source: string,
  filePath: string,
  kind: SheetReferenceKind,
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    const sheetName = match[1]?.trim();
    if (!sheetName || sheetName.includes("${")) continue;
    refs.push({
      sheetName,
      filePath,
      line: lineNumberAt(source, match.index),
      kind,
    });
  }
}

function dedupeRefs(refs: SheetReference[]): SheetReference[] {
  const seen = new Set<string>();
  return refs.filter(ref => {
    const key = `${ref.sheetName}\u0000${ref.filePath}\u0000${ref.line}\u0000${ref.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function canonical(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function preferredTitle(titles: string[]): string {
  const pascal = titles.find(title => /^[A-Z]/.test(title) && title.includes("_"));
  return pascal || titles[0];
}

function looksLikeBackupOrLegacy(title: string): boolean {
  return /\b(backup|archive|legacy|pre[_-]?ws|phase|copy)\b/i.test(title) ||
    /(^|[_-])backup([_-]|$)/i.test(title);
}

function statusRank(status: SheetClassification["status"]): number {
  if (status === "KEEP") return 0;
  if (status === "REVIEW") return 1;
  return 2;
}
