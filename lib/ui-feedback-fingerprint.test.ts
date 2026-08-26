// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { buildFingerprint, buildSelectorPath, findDebugSource, textSnippet } from "./ui-feedback-fingerprint";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buildSelectorPath", () => {
  it("builds a plain tag path with no index when there is no ambiguous sibling", () => {
    document.body.innerHTML = `<div><section><button>Go</button></section></div>`;
    const button = document.querySelector("button")!;
    expect(buildSelectorPath(button)).toBe("div > section > button");
  });

  it("adds :nth-of-type only where a same-tag sibling makes it ambiguous", () => {
    document.body.innerHTML = `
      <div>
        <button id="a">A</button>
        <button id="b">B</button>
        <section><span>only span</span></section>
      </div>
    `;
    const second = document.getElementById("b")!;
    const span = document.querySelector("span")!;
    expect(buildSelectorPath(second)).toBe("div > button:nth-of-type(2)");
    expect(buildSelectorPath(span)).toBe("div > section > span");
  });

  it("stops at BODY, never includes it in the path", () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector("button")!;
    expect(buildSelectorPath(button)).toBe("button");
  });
});

describe("textSnippet", () => {
  it("collapses whitespace and trims", () => {
    document.body.innerHTML = `<p>  Thanh   toán \n thành công  </p>`;
    const p = document.querySelector("p")!;
    expect(textSnippet(p)).toBe("Thanh toán thành công");
  });

  it("truncates to the given length, default 80", () => {
    document.body.innerHTML = `<p>${"a".repeat(200)}</p>`;
    const p = document.querySelector("p")!;
    expect(textSnippet(p)).toHaveLength(80);
    expect(textSnippet(p, 10)).toHaveLength(10);
  });
});

describe("findDebugSource", () => {
  it("returns null when the element carries no React fiber at all", () => {
    document.body.innerHTML = `<button>Go</button>`;
    expect(findDebugSource(document.querySelector("button")!)).toBeNull();
  });

  it("reads _debugSource off the element's own fiber", () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector("button")!;
    (button as any).__reactFiber$abc123 = {
      _debugSource: { fileName: "components/Foo.tsx", lineNumber: 12, columnNumber: 5 },
      return: null,
    };
    expect(findDebugSource(button)).toEqual({
      fileName: "components/Foo.tsx",
      lineNumber: 12,
      columnNumber: 5,
    });
  });

  it("falls back to an ancestor fiber's _debugSource when the element's own fiber lacks one", () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector("button")!;
    const grandparentFiber = {
      _debugSource: { fileName: "components/Wrapper.tsx", lineNumber: 40, columnNumber: 3 },
      return: null,
    };
    const parentFiber = { _debugSource: undefined, return: grandparentFiber };
    (button as any).__reactFiber$xyz789 = { _debugSource: undefined, return: parentFiber };

    expect(findDebugSource(button)).toEqual({
      fileName: "components/Wrapper.tsx",
      lineNumber: 40,
      columnNumber: 3,
    });
  });

  it("gives up and returns null rather than looping forever on a cyclic fiber graph", () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector("button")!;
    const cyclic: any = { _debugSource: undefined };
    cyclic.return = cyclic;
    (button as any).__reactFiber$loop = cyclic;

    expect(findDebugSource(button)).toBeNull();
  });
});

describe("buildFingerprint", () => {
  it("combines the selector, className, text snippet, route and viewport with a null source when unavailable", () => {
    document.body.innerHTML = `<div class="rounded-lg px-4">Thanh toán thành công</div>`;
    const el = document.querySelector("div")!;

    const fp = buildFingerprint(el);

    expect(fp.selector).toBe("div");
    expect(fp.className).toBe("rounded-lg px-4");
    expect(fp.textSnippet).toBe("Thanh toán thành công");
    expect(fp.route).toBe(window.location.pathname);
    expect(fp.viewportWidth).toBe(window.innerWidth);
    expect(fp.sourceFile).toBeNull();
    expect(fp.sourceLine).toBeNull();
    expect(fp.sourceColumn).toBeNull();
  });

  it("includes the exact source location when the fiber carries one", () => {
    document.body.innerHTML = `<div>x</div>`;
    const el = document.querySelector("div")!;
    (el as any).__reactFiber$test = {
      _debugSource: { fileName: "app/pos/page.tsx", lineNumber: 7, columnNumber: 2 },
      return: null,
    };

    const fp = buildFingerprint(el);
    expect(fp.sourceFile).toBe("app/pos/page.tsx");
    expect(fp.sourceLine).toBe(7);
    expect(fp.sourceColumn).toBe(2);
  });
});
