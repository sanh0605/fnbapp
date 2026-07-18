import { toSaigonIsoString } from "./datetime";

export function getSaigonDateStamp(date = new Date()): string {
  return toSaigonIsoString(date).slice(0, 10);
}

export function parseDeleteOneOffList(plan: string): string[] {
  const section = plan.split("## DELETE_ONE_OFF")[1]?.split(/\r?\n## /)[0];
  if (!section) {
    throw new Error(
      "Could not find DELETE_ONE_OFF section in script-cleanup-plan.md",
    );
  }
  const names = [...section.matchAll(/`([^`]+\.(?:ts|js))`/g)]
    .map(match => match[1]);
  if (names.length === 0) {
    throw new Error(
      "Parsed 0 DELETE_ONE_OFF entries -- plan format may have changed",
    );
  }
  return names;
}

export function hasScriptReference(
  content: string,
  scriptName: string,
): boolean {
  const extension = scriptName.match(/\.(ts|js)$/)?.[0];
  if (!extension) return false;

  const base = scriptName.slice(0, -extension.length);
  const escapedBase = escapeRegex(base);
  const escapedExtension = escapeRegex(extension);
  const escapedFullName = escapeRegex(scriptName);
  const modulePath = `(?:[^'\"]*[\\\\/])?${escapedBase}(?:${escapedExtension})?`;
  const fullScriptPath = `scripts[\\\\/]${escapedFullName}(?![A-Za-z0-9_.-])`;
  const runnerFile = `${escapedFullName}(?![A-Za-z0-9_.-])`;

  return [
    new RegExp(`from\\s+['\"]${modulePath}['\"]`),
    new RegExp(`require\\s*\\(\\s*['\"]${modulePath}['\"]\\s*\\)`),
    new RegExp(`import\\s*\\(\\s*['\"]${modulePath}['\"]\\s*\\)`),
    new RegExp(`import\\s+['\"]${modulePath}['\"]`),
    new RegExp(fullScriptPath),
    new RegExp(`(?:vite-node(?:\\.\\w+)?|tsx|node)\\s+${runnerFile}`),
  ].some(pattern => pattern.test(content));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
