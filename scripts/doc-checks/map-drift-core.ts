import { parseRelationBlock } from "../doc-map/relation-block";
import type { CheckResult } from "../check-result";

export function checkMapDrift(generatedMarkdown: string, handMarkdown: string): CheckResult {
  const gen = parseRelationBlock(generatedMarkdown).filter(r => r.kind === "write");
  const hand = new Set(parseRelationBlock(handMarkdown).map(r => `${r.from} -> ${r.to} (${r.kind})`));
  const problems = gen
    .filter(r => !hand.has(`${r.from} -> ${r.to} (write)`))
    .map(r => `hand SYSTEM-MAP.md is missing write relation: ${r.from} -> ${r.to}`);
  return { check: "map-drift", ok: problems.length === 0, problems };
}
