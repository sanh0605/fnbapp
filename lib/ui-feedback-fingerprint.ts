// Element identification for the point-and-comment dev tool.
// docs/superpowers/plans/2026-08-26-ui-feedback-tool.md section 4.
//
// Two independent signals, captured together:
//
// - The plan's own baseline (always available): a CSS selector path from
//   <body>, className, a text snippet, the route and the viewport width.
// - An exact file/line, when available: React's development build stores
//   each JSX element's source location on its Fiber as _debugSource,
//   reachable from the real DOM node via a property key that starts with
//   "__reactFiber$" (the random suffix changes per React instance -- the
//   same mechanism React DevTools and tools like click-to-react-component
//   use). Verified empirically against a real `next dev` build (not
//   assumed): Next's default dev transform emits this for every JSX
//   element via react/jsx-dev-runtime's jsxDEV, no extra Babel/SWC plugin.
//   It does not exist in production's react-dom build at all, so this
//   naturally contributes nothing there even before section 6's own guards
//   run -- but the traversal itself is still guarded (returns null) rather
//   than assumed present, since a future React/Next version could change
//   the internal field name.

export interface ElementFingerprint {
  selector: string;
  className: string;
  textSnippet: string;
  route: string;
  viewportWidth: number;
  sourceFile: string | null;
  sourceLine: number | null;
  sourceColumn: number | null;
}

// A selector path from <body> to el: tag name, with :nth-of-type only when
// a sibling of the same tag would otherwise make it ambiguous.
export function buildSelectorPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.parentElement && node.nodeName !== "BODY") {
    const current: Element = node;
    const parent: Element = node.parentElement;
    const tag = current.nodeName.toLowerCase();
    const sameTagSiblings: Element[] = Array.from(parent.children).filter(
      (c: Element) => c.nodeName === current.nodeName,
    );
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    } else {
      parts.unshift(tag);
    }
    node = parent;
  }

  return parts.length > 0 ? parts.join(" > ") : el.nodeName.toLowerCase();
}

// First ~80 characters of textContent, whitespace collapsed -- Vietnamese
// UI text is distinctive and greps well (plan section 4).
export function textSnippet(el: Element, maxLength = 80): string {
  const collapsed = (el.textContent || "").replace(/\s+/g, " ").trim();
  return collapsed.slice(0, maxLength);
}

interface DebugSource {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

function findFiberPropertyKey(el: Element): string | null {
  return Object.keys(el).find(k => k.startsWith("__reactFiber$")) ?? null;
}

// Walks up from el's own Fiber toward the root looking for _debugSource --
// a plain host element (a clicked <div>/<button>) almost always carries its
// own, but a wrapper without one falls back to its nearest ancestor's.
// Capped so a malformed or cyclic fiber graph cannot loop forever.
export function findDebugSource(el: Element): DebugSource | null {
  const fiberKey = findFiberPropertyKey(el);
  if (!fiberKey) return null;

  let fiber: any = (el as any)[fiberKey];
  let hops = 0;
  while (fiber && hops < 30) {
    const source = fiber._debugSource;
    if (source && typeof source.fileName === "string") {
      return {
        fileName: source.fileName,
        lineNumber: source.lineNumber,
        columnNumber: source.columnNumber,
      };
    }
    fiber = fiber.return;
    hops++;
  }
  return null;
}

export function buildFingerprint(el: Element): ElementFingerprint {
  const source = findDebugSource(el);
  const className = (el as HTMLElement).className;
  return {
    selector: buildSelectorPath(el),
    className: typeof className === "string" ? className : "",
    textSnippet: textSnippet(el),
    route: window.location.pathname,
    viewportWidth: window.innerWidth,
    sourceFile: source?.fileName ?? null,
    sourceLine: source?.lineNumber ?? null,
    sourceColumn: source?.columnNumber ?? null,
  };
}
