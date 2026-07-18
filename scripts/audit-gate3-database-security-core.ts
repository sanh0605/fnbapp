export type FunctionSecurityRow = {
  name: string;
  identityArguments: string;
  resultType: string;
  owner: string;
  securityDefiner: boolean;
  anonCanExecute: boolean;
  authenticatedCanExecute: boolean;
  serviceRoleCanExecute: boolean;
  definition: string;
};

export type RawSqlExposure = {
  candidates: string[];
  exposedToAnon: string[];
  exposedToAuthenticated: string[];
  stopGate: boolean;
};

export function normalizeManagementRows<T>(payload: unknown): T[] {
  if (payload == null) return [];
  return (Array.isArray(payload) ? payload : [payload]) as T[];
}

export function buildReadOnlyManagementUrl(supabaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error("Cannot derive Supabase project ref from SUPABASE_URL");
  }
  const hostParts = parsed.hostname.split(".");
  const projectRef = hostParts.length >= 3 && hostParts.slice(-2).join(".") === "supabase.co"
    ? hostParts[0]
    : "";
  if (!projectRef) {
    throw new Error("Cannot derive Supabase project ref from SUPABASE_URL");
  }
  return `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`;
}

export function detectCallerCheckSignals(definition: string): string[] {
  const lower = definition.toLowerCase();
  const patterns: Array<[string, RegExp]> = [
    ["auth.uid()", /\bauth\s*\.\s*uid\s*\(/],
    ["auth.role()", /\bauth\s*\.\s*role\s*\(/],
    ["current_user", /\bcurrent_user\b/],
    ["session_user", /\bsession_user\b/],
    ["request.jwt.claims", /request\.jwt\.claims/],
    ["request.jwt.claim", /request\.jwt\.claim(?!s)/],
  ];
  return patterns
    .filter(([, pattern]) => pattern.test(lower))
    .map(([label]) => label);
}

export function compareTableScope(
  liveTables: readonly string[],
  backupTables: readonly string[],
): { liveNotBackedUp: string[]; backedUpNotLive: string[] } {
  const live = new Set(liveTables);
  const backup = new Set(backupTables);
  return {
    liveNotBackedUp: [...live].filter(table => !backup.has(table)).sort(),
    backedUpNotLive: [...backup].filter(table => !live.has(table)).sort(),
  };
}

export function assessRawSqlExposure(
  functions: readonly FunctionSecurityRow[],
): RawSqlExposure {
  const candidates = functions.filter(isRawSqlRpc);
  const signature = (row: FunctionSecurityRow) =>
    `${row.name}(${row.identityArguments})`;
  return {
    candidates: candidates.map(signature).sort(),
    exposedToAnon: candidates.filter(row => row.anonCanExecute).map(signature).sort(),
    exposedToAuthenticated: candidates
      .filter(row => row.authenticatedCanExecute)
      .map(signature)
      .sort(),
    stopGate: candidates.some(
      row => row.anonCanExecute || row.authenticatedCanExecute,
    ),
  };
}

function isRawSqlRpcName(name: string): boolean {
  const normalized = name.toLowerCase();
  return /^(exec|execute|run|query)_?sql$/.test(normalized) ||
    /^sql_?(exec|execute|run|query)$/.test(normalized);
}

function isRawSqlRpc(row: FunctionSecurityRow): boolean {
  if (isRawSqlRpcName(row.name)) return true;
  const rawTextArguments = [...row.identityArguments.toLowerCase().matchAll(
    /\b((?:p_)?(?:query|sql|statement|command))\s+text\b/g,
  )].map(match => match[1]);
  const definition = row.definition.toLowerCase();
  return rawTextArguments.some(argument =>
    new RegExp(`\\bexecute\\s+${argument}\\b`).test(definition)
  );
}
