// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListPageHeader } from "./ListPageHeader";

afterEach(cleanup);

describe("ListPageHeader responsive behavior (C3)", () => {
  it("title block is capped (max-w-[calc(100%-5rem)], full width from md) when there is an action", () => {
    const { container } = render(
      <ListPageHeader
        group="Kho"
        title="Thời hạn khấu hao"
        action={<button type="button">Tài sản</button>}
      />
    );

    const titleEl = screen.getByText("Thời hạn khấu hao");
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement?.className).toContain("shrink-0");
    expect(titleEl.parentElement?.className).toContain(
      "max-w-[calc(100%-5rem)]"
    );
    expect(titleEl.parentElement?.className).toContain("md:max-w-full");

    const headerContainer = container.firstElementChild as HTMLElement;
    expect(headerContainer.className).toContain("flex-wrap");
  });

  it("with no action the title block has max-w-full and no calc", () => {
    render(
      <ListPageHeader
        group="Kho"
        title="Thời hạn khấu hao"
      />
    );

    const titleEl = screen.getByText("Thời hạn khấu hao");
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement?.className).toContain("shrink-0");
    expect(titleEl.parentElement?.className).toContain("max-w-full");
    expect(titleEl.parentElement?.className).not.toContain("calc");
  });
});
