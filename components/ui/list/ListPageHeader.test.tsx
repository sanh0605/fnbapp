// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListPageHeader } from "./ListPageHeader";

afterEach(cleanup);

describe("ListPageHeader responsive behavior (C3)", () => {
  it("renders title with shrink-0 max-w-full and flex-wrap container so buttons wrap when tight", () => {
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
    expect(titleEl.parentElement?.className).toContain("max-w-full");

    const headerContainer = container.firstElementChild as HTMLElement;
    expect(headerContainer.className).toContain("flex-wrap");
  });
});
