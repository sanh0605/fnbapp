// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhoneRow } from "./PhoneRow";

afterEach(cleanup);

describe("BR-UI-018 PhoneRow", () => {
  it("renders title, value, meta, and badge with two-line clamps, tabular nowrap value, and no bold classes", () => {
    const longTitle =
      "Nhà cung cấp nguyên liệu pha chế trà sữa cà phê đặc sản vùng cao nguyên Lâm Đồng";
    expect(longTitle).toHaveLength(80);

    const { container } = render(
      <PhoneRow
        title={longTitle}
        value="12,450,000đ"
        meta="16/10/2026 · PN-001 · Tiền mặt"
        badge={<span>Hoàn thành</span>}
      />,
    );

    const titleEl = screen.getByText(longTitle);
    expect(titleEl.className).toContain("line-clamp-2");

    const valueEl = screen.getByText("12,450,000đ");
    expect(valueEl.className).toContain("whitespace-nowrap");
    expect(valueEl.className).toContain("tabular-nums");

    const metaEl = screen.getByText("16/10/2026 · PN-001 · Tiền mặt");
    expect(metaEl.className).toContain("line-clamp-2");
    expect(metaEl.className).not.toContain("truncate");

    expect(screen.getByText("Hoàn thành")).toBeInTheDocument();

    for (const el of Array.from(container.querySelectorAll("*"))) {
      expect(el.className).not.toMatch(/\bfont-(bold|semibold)\b/);
    }
  });

  it("renders the meta element with line-clamp-2 and not truncate", () => {
    render(
      <PhoneRow
        title="Tiêu đề"
        meta="Thông tin phụ một dòng"
      />,
    );
    const metaEl = screen.getByText("Thông tin phụ một dòng");
    expect(metaEl.className).toContain("line-clamp-2");
    expect(metaEl.className).not.toContain("truncate");
  });

  it("omits the second line when both meta and badge are absent", () => {
    const { container } = render(<PhoneRow title="Đường cát" value="25,000đ" />);

    expect(screen.getByText("Đường cát")).toBeInTheDocument();
    expect(screen.getByText("25,000đ")).toBeInTheDocument();
    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});

