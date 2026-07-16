import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT_DIR, 'app');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'components');
const OUT_FILE = path.join(ROOT_DIR, 'docs', 'audits', 'ui-consistency-2026-07-16.md');

interface Finding {
  file: string;
  rule: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  line?: number;
  match?: string;
  routeGroup?: string;
}

const findings: Finding[] = [];

const COLORS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose'
];

const RAW_COLOR_REGEX = new RegExp(
  `\\b(?:text|bg|border|ring|fill|stroke)-(?:${COLORS.join('|')})-\\d{2,3}(?:\\/\\d+)?\\b`,
  'g'
);
const HEX_COLOR_REGEX = /\b(?:text|bg|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;
const ALERT_CONFIRM_REGEX = /\b(?:window\.)?(alert|confirm)\s*\(/g;
const STICKY_FILTER_BAR_REGEX = /\bStickyFilterBar\b/g;
const INLINE_STYLE_COLOR_REGEX = /style=\{\{\s*[^}]*color\s*:/g;

function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let hasPage = false;
  let hasError = false;
  let hasLoading = false;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      if (entry.name === 'page.tsx') hasPage = true;
      if (entry.name === 'error.tsx') hasError = true;
      if (entry.name === 'loading.tsx') hasLoading = true;

      if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        scanFile(fullPath);
      }
    }
  }

  if (hasPage && dir.startsWith(APP_DIR)) {
    const route = path.relative(APP_DIR, dir) || '/';
    const routeGroup = getRouteGroup(route);
    
    if (!hasError) {
      findings.push({
        file: path.join(route, 'error.tsx'),
        rule: 'Missing error.tsx boundary per route',
        severity: 'medium',
        category: 'ADD-BOUNDARY',
        routeGroup
      });
    }
    if (!hasLoading) {
      findings.push({
        file: path.join(route, 'loading.tsx'),
        rule: 'Missing loading.tsx',
        severity: 'low',
        category: 'ADD-BOUNDARY',
        routeGroup
      });
    }
  }
}

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(ROOT_DIR, filePath);
  const routeGroup = getRouteGroup(relPath);
  const categoryOverrides = relPath.includes('modifiers') ? 'DEFERRED (modifiers module)' : null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    let match;
    while ((match = RAW_COLOR_REGEX.exec(line)) !== null) {
      findings.push({
        file: relPath,
        rule: 'Raw semantic Tailwind colors',
        severity: 'medium',
        category: categoryOverrides || 'TOKEN-SWAP',
        line: i + 1,
        match: match[0],
        routeGroup
      });
    }
    
    RAW_COLOR_REGEX.lastIndex = 0;

    while ((match = HEX_COLOR_REGEX.exec(line)) !== null) {
      findings.push({
        file: relPath,
        rule: 'Hardcoded hex not in tokens',
        severity: 'high',
        category: categoryOverrides || 'TOKEN-SWAP',
        line: i + 1,
        match: match[0],
        routeGroup
      });
    }
    
    HEX_COLOR_REGEX.lastIndex = 0;

    while ((match = ALERT_CONFIRM_REGEX.exec(line)) !== null) {
      findings.push({
        file: relPath,
        rule: 'Native alert/confirm',
        severity: 'high',
        category: categoryOverrides || 'REPLACE-ALERT',
        line: i + 1,
        match: match[0],
        routeGroup
      });
    }
    
    ALERT_CONFIRM_REGEX.lastIndex = 0;

    while ((match = STICKY_FILTER_BAR_REGEX.exec(line)) !== null) {
      findings.push({
        file: relPath,
        rule: 'StickyFilterBar usage',
        severity: 'high',
        category: categoryOverrides || 'REMOVE-STICKYBAR',
        line: i + 1,
        match: match[0],
        routeGroup
      });
    }
    
    STICKY_FILTER_BAR_REGEX.lastIndex = 0;

    while ((match = INLINE_STYLE_COLOR_REGEX.exec(line)) !== null) {
      findings.push({
        file: relPath,
        rule: 'Inline style color',
        severity: 'low',
        category: categoryOverrides || 'TOKEN-SWAP',
        line: i + 1,
        match: match[0],
        routeGroup
      });
    }
    
    INLINE_STYLE_COLOR_REGEX.lastIndex = 0;
  }
}

function getRouteGroup(relPath: string): string {
  if (relPath.includes('app\\admin') || relPath.includes('app/admin')) {
    return 'admin grouped';
  } else if (relPath.includes('app\\pos') || relPath.includes('app/pos')) {
    return 'POS';
  } else if (relPath.includes('app\\login') || relPath.includes('app/login')) {
    return 'login';
  } else {
    return 'public/others';
  }
}

function run() {
  if (fs.existsSync(APP_DIR)) scanDir(APP_DIR);
  if (fs.existsSync(COMPONENTS_DIR)) scanDir(COMPONENTS_DIR);

  // Generate Report
  const summaryMap: Record<string, { severity: string, count: number }> = {};
  for (const f of findings) {
    if (!summaryMap[f.rule]) {
      summaryMap[f.rule] = { severity: f.severity, count: 0 };
    }
    summaryMap[f.rule].count++;
  }

  let report = `# UI Consistency Audit Report
Date: 2026-07-16
Status: REPORT ONLY

## Summary

| Rule | Severity | Count |
|---|---|---|
`;

  for (const [rule, data] of Object.entries(summaryMap)) {
    report += `| ${rule} | ${data.severity} | ${data.count} |\n`;
  }

  const byRouteGroup: Record<string, Finding[]> = {};
  for (const f of findings) {
    const group = f.routeGroup || 'other';
    if (!byRouteGroup[group]) byRouteGroup[group] = [];
    byRouteGroup[group].push(f);
  }

  report += `\n## Per-route findings\n`;

  for (const [group, items] of Object.entries(byRouteGroup)) {
    report += `\n### ${group}\n\n`;
    for (const item of items) {
      const loc = item.line ? `L${item.line}` : 'File';
      const matchText = item.match ? ` (\`${item.match}\`)` : '';
      report += `- **${item.rule}** [${item.severity}] in \`${item.file.replace(/\\\\/g, '/')}:${loc}\` ${matchText} → Category: ${item.category}\n`;

    }
  }

  fs.writeFileSync(OUT_FILE, report);
  console.log(`Audit complete. Found ${findings.length} issues. Report written to ${OUT_FILE}`);
}

run();
