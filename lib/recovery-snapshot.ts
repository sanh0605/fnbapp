import { createHash } from "node:crypto";

type SheetSnapshot = {
  values: unknown[][];
  [representation: string]: unknown;
};

type SnapshotInput = {
  runId: string;
  capturedAt: string;
  sourceHash?: string;
  sheets: Record<string, SheetSnapshot>;
  supabase: Record<string, Array<Record<string, unknown>>>;
};

type SourceSummary = {
  rowCount: number;
  columns: string[];
  ids: string[];
};

export function buildRecoveryRunId(date = new Date()): string {
  const compactTimestamp = date
    .toISOString()
    .replace(/[-:.]/g, "");
  return `recovery-${compactTimestamp}`;
}

export function createSnapshotBundleFiles(
  input: SnapshotInput,
): Record<string, string> {
  assertSafeRunId(input.runId);
  const files: Record<string, string> = {};
  const googleSheetsSummary: Record<string, SourceSummary> = {};
  const supabaseSummary: Record<string, SourceSummary> = {};

  for (const sheetName of Object.keys(input.sheets).sort()) {
    const values = input.sheets[sheetName].values;
    const headers = (values[0] || []).map(value => String(value ?? ""));
    const canonicalRows = values.slice(1).map(row =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""]),
      ),
    );
    const rawPath = `google-sheets/${sheetName}.raw.json`;
    const canonicalPath = `canonical/google-sheets/${sheetName}.json`;
    files[rawPath] = formatJson(input.sheets[sheetName]);
    files[canonicalPath] = formatJson(sortRows(canonicalRows));
    googleSheetsSummary[sheetName] = summarizeRows(
      canonicalRows,
      headers,
    );
  }

  for (const tableName of Object.keys(input.supabase).sort()) {
    const rows = input.supabase[tableName];
    const columns = Array.from(
      new Set(rows.flatMap(row => Object.keys(row))),
    ).sort();
    const rawPath = `supabase/${tableName}.raw.json`;
    const canonicalPath = `canonical/supabase/${tableName}.json`;
    files[rawPath] = formatJson({ rows });
    files[canonicalPath] = formatJson(sortRows(rows));
    supabaseSummary[tableName] = summarizeRows(rows, columns);
  }

  const fileManifest = Object.fromEntries(
    Object.keys(files).sort().map(filePath => [
      filePath,
      {
        sha256: createHash("sha256")
          .update(files[filePath])
          .digest("hex"),
        bytes: Buffer.byteLength(files[filePath], "utf8"),
      },
    ]),
  );
  files["manifest.json"] = formatJson({
    formatVersion: 1,
    runId: input.runId,
    capturedAt: input.capturedAt,
    ...(input.sourceHash ? { sourceHash: input.sourceHash } : {}),
    files: fileManifest,
    sources: {
      googleSheets: googleSheetsSummary,
      supabase: supabaseSummary,
    },
  });
  return files;
}

export function verifySnapshotBundleFiles(
  files: Record<string, string>,
): { valid: boolean; checkedFiles: number; errors: string[] } {
  const errors: string[] = [];
  let manifest: {
    files?: Record<string, { sha256: string; bytes: number }>;
  };
  try {
    manifest = JSON.parse(files["manifest.json"]);
  } catch {
    return {
      valid: false,
      checkedFiles: 0,
      errors: ["Invalid or missing manifest.json"],
    };
  }

  const expectedFiles = manifest.files || {};
  for (const [filePath, expected] of Object.entries(expectedFiles)) {
    const content = files[filePath];
    if (content === undefined) {
      errors.push(`Missing file: ${filePath}`);
      continue;
    }
    const actualHash = createHash("sha256")
      .update(content)
      .digest("hex");
    if (actualHash !== expected.sha256) {
      errors.push(`Hash mismatch: ${filePath}`);
    }
    if (Buffer.byteLength(content, "utf8") !== expected.bytes) {
      errors.push(`Byte count mismatch: ${filePath}`);
    }
  }

  for (const filePath of Object.keys(files)) {
    if (filePath !== "manifest.json" && !(filePath in expectedFiles)) {
      errors.push(`Unexpected file: ${filePath}`);
    }
  }
  return {
    valid: errors.length === 0,
    checkedFiles: Object.keys(expectedFiles).length,
    errors,
  };
}

function assertSafeRunId(runId: string): void {
  if (!/^recovery-\d{8}T\d{9}Z$/.test(runId)) {
    throw new Error(`Invalid recovery run ID: ${runId}`);
  }
}

function summarizeRows(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): SourceSummary {
  return {
    rowCount: rows.length,
    columns: [...columns].sort(),
    ids: rows
      .map(row => String(row.id || ""))
      .filter(Boolean)
      .sort(),
  };
}

function sortRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows
    .map(row => canonicalizeObject(row))
    .sort((left, right) => {
      const leftId = String(left.id || "");
      const rightId = String(right.id || "");
      return leftId.localeCompare(rightId) ||
        JSON.stringify(left).localeCompare(JSON.stringify(right));
    });
}

function canonicalizeObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalizeValue(value[key])]),
  );
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (value && typeof value === "object") {
    return canonicalizeObject(value as Record<string, unknown>);
  }
  return value;
}

function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
