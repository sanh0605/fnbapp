// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("stacks title block and actions on phone (flex-col) and places them side by side on computer (md:flex-row)", () => {
    const { container } = render(
      <PageHeader
        title="Quản lý nhà cung cấp"
        actions={<button type="button">Thêm mới</button>}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("flex-col");
    expect(root.className).toContain("md:flex-row");
    expect(root.className).toContain("md:items-center");
    expect(screen.getByRole("heading", { name: "Quản lý nhà cung cấp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm mới" })).toBeInTheDocument();
  });

  it("wraps a long subtitle", () => {
    const longSubtitle =
      "Danh sách nhà cung cấp toàn bộ chuỗi chi nhánh và đối tác phân phối nguyên vật liệu thực phẩm đồ uống tươi sống";
    render(
      <PageHeader
        title="Nhà cung cấp"
        subtitle={longSubtitle}
      />
    );

    const subtitleEl = screen.getByText(longSubtitle);
    expect(subtitleEl).toBeInTheDocument();
    expect(subtitleEl.className).toContain("break-words");
    expect(subtitleEl.className).not.toContain("truncate");
    expect(subtitleEl.className).not.toContain("whitespace-nowrap");

    const titleBlock = subtitleEl.parentElement as HTMLElement;
    expect(titleBlock.className).toContain("min-w-0");
  });
});
