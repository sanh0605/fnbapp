// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DateRangeButton } from "./DateRangeButton";
import { DATE_RANGE_PRESETS, MONTH_PRESET_KEYS, PHONE_PRESET_KEYS, presetLabel } from "@/lib/shared/date-range-presets";

// jsdom implements neither; the phone panel scrolls its button to the top.
beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const TODAY = "2026-10-09";
const THIS_MONTH = { preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" } as const;

function open(value: Parameters<typeof DateRangeButton>[0]["value"] = THIS_MONTH, extra: Partial<Parameters<typeof DateRangeButton>[0]> = {}) {
  const onChange = vi.fn();
  render(<DateRangeButton value={value} onChange={onChange} today={TODAY} {...extra} />);
  fireEvent.click(screen.getByTestId("range-button"));
  return {
    onChange,
    desktop: () => within(screen.getByTestId("range-panel-desktop")),
    phone: () => within(screen.getByTestId("range-panel-phone")),
  };
}

function presetButtonsIn(panel: HTMLElement, labels: string[]): string[] {
  return within(panel).getAllByRole("button").map(b => b.textContent?.trim() ?? "").filter(t => labels.includes(t));
}

function typeDay(scope: ReturnType<typeof within>, label: string, text: string) {
  const input = scope.getByLabelText(label);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
}

describe("DateRangeButton -- the button", () => {
  it("names the range and its days, panel closed", () => {
    render(<DateRangeButton value={THIS_MONTH} onChange={vi.fn()} today={TODAY} />);
    expect(screen.getByTestId("range-button")).toHaveTextContent("Tháng này · 01/10/2026 – 31/10/2026");
    expect(screen.queryByTestId("range-panel-desktop")).toBeNull();
    expect(screen.queryByTestId("range-panel-phone")).toBeNull();
  });

  it("a range the phone has no button for still shows, and no phone button is lit", () => {
    const { phone } = open({ preset: "LAST_7_DAYS", start: "2026-10-02", end: "2026-10-08" });
    expect(screen.getByTestId("range-button")).toHaveTextContent("7 ngày qua · 02/10/2026 – 08/10/2026");
    const lit = phone().getAllByRole("button").filter(b => b.getAttribute("aria-pressed") === "true");
    expect(lit).toHaveLength(0);
  });

  it("disabled while searching: the hint shows and nothing opens", () => {
    const hint = "Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày";
    render(<DateRangeButton value={THIS_MONTH} onChange={vi.fn()} today={TODAY} disabled disabledHint={hint} />);
    expect(screen.getByTestId("range-button")).toBeDisabled();
    expect(screen.getByText(hint)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("range-button"));
    expect(screen.queryByTestId("range-panel-desktop")).toBeNull();
  });

  it("rendered with label='Thời gian', the text 'Thời gian' is on screen and the button does not have 'Thời gian' in its accessible name; without label, no 'Thời gian'", () => {
    const { rerender } = render(<DateRangeButton value={THIS_MONTH} onChange={vi.fn()} today={TODAY} label="Thời gian" />);
    expect(screen.getByText("Thời gian")).toBeInTheDocument();
    const btn = screen.getByTestId("range-button");
    expect(btn).not.toHaveAccessibleName(/Thời gian/);
    expect(btn).toHaveAccessibleDescription("Thời gian");

    rerender(<DateRangeButton value={THIS_MONTH} onChange={vi.fn()} today={TODAY} />);
    expect(screen.queryByText("Thời gian")).toBeNull();
    expect(screen.getByTestId("range-button")).not.toHaveAttribute("aria-describedby");
  });
});

describe("DateRangeButton -- ready ranges", () => {
  const ALL = DATE_RANGE_PRESETS.map(p => p.label);

  it("the computer lists all 16 ranges in order; the phone lists the nine", () => {
    open();
    expect(presetButtonsIn(screen.getByTestId("range-panel-desktop"), ALL)).toEqual(ALL);
    expect(presetButtonsIn(screen.getByTestId("range-panel-phone"), ALL)).toEqual(PHONE_PRESET_KEYS.map(presetLabel));
  });

  it("the range in use is lit", () => {
    const { desktop } = open();
    expect(desktop().getByRole("button", { name: "Tháng này" })).toHaveAttribute("aria-pressed", "true");
    expect(desktop().getByRole("button", { name: "Tháng trước" })).toHaveAttribute("aria-pressed", "false");
  });

  it("a ready range applies at once and closes the panel", () => {
    const { onChange, desktop } = open();
    fireEvent.click(desktop().getByRole("button", { name: "Tháng trước" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ preset: "LAST_MONTH", start: "2026-09-01", end: "2026-09-30" });
    expect(screen.queryByTestId("range-panel-desktop")).toBeNull();
  });

  it("the same from the phone", () => {
    const { onChange, phone } = open();
    fireEvent.click(phone().getByRole("button", { name: "Hôm qua" }));
    expect(onChange).toHaveBeenCalledWith({ preset: "YESTERDAY", start: "2026-10-08", end: "2026-10-08" });
  });
});

describe("DateRangeButton -- typed days", () => {
  it("phone: Tuỳ chọn swaps the nine buttons for two day boxes, nothing applied yet", () => {
    const { onChange, phone } = open();
    fireEvent.click(phone().getByRole("button", { name: "Tuỳ chọn" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(phone().getByLabelText("Từ ngày")).toBeInTheDocument();
    expect(phone().getByLabelText("Đến ngày")).toBeInTheDocument();
    expect(phone().queryByRole("button", { name: "Hôm qua" })).toBeNull();
  });

  it("two typed days apply on Áp dụng", () => {
    const { onChange, desktop } = open();
    typeDay(desktop(), "Từ ngày", "15/09/2026");
    typeDay(desktop(), "Đến ngày", "24/09/2026");
    fireEvent.click(desktop().getByRole("button", { name: "Áp dụng" }));
    expect(onChange).toHaveBeenCalledWith({ preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" });
  });

  it("a day that does not exist is refused", () => {
    const { onChange, desktop } = open();
    typeDay(desktop(), "Từ ngày", "31/02/2026");
    expect(desktop().getByText("Ngày không hợp lệ")).toBeInTheDocument();
    expect(desktop().getByRole("button", { name: "Áp dụng" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a first day after the last is refused", () => {
    const { desktop } = open();
    typeDay(desktop(), "Từ ngày", "24/09/2026");
    typeDay(desktop(), "Đến ngày", "15/09/2026");
    expect(desktop().getByText("Ngày đầu phải trước ngày cuối")).toBeInTheDocument();
    expect(desktop().getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  });

  it("Huỷ closes without applying; the button keeps its range", () => {
    const { onChange, desktop } = open();
    typeDay(desktop(), "Từ ngày", "15/09/2026");
    fireEvent.click(desktop().getByRole("button", { name: "Huỷ" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("range-panel-desktop")).toBeNull();
    expect(screen.getByTestId("range-button")).toHaveTextContent("Tháng này · 01/10/2026 – 31/10/2026");
  });

  it("Escape closes without applying", () => {
    const { onChange } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("range-panel-desktop")).toBeNull();
  });
});

describe("DateRangeButton -- months (Lãi lỗ)", () => {
  const YEAR = { preset: "THIS_YEAR", start: "2026-01", end: "2026-10" } as const;
  const ALL = DATE_RANGE_PRESETS.map(p => p.label);

  it("writes months and offers whole-month ranges only", () => {
    open(YEAR, { mode: "month" });
    expect(screen.getByTestId("range-button")).toHaveTextContent("Năm nay · 01/2026 – 10/2026");
    expect(presetButtonsIn(screen.getByTestId("range-panel-desktop"), ALL)).toEqual(MONTH_PRESET_KEYS.map(presetLabel));
  });

  it("two typed months apply on Áp dụng, across a year", () => {
    const { onChange, desktop } = open(YEAR, { mode: "month" });
    typeDay(desktop(), "Từ tháng", "07/2025");
    typeDay(desktop(), "Đến tháng", "06/2026");
    fireEvent.click(desktop().getByRole("button", { name: "Áp dụng" }));
    expect(onChange).toHaveBeenCalledWith({ preset: "CUSTOM", start: "2025-07", end: "2026-06" });
  });

  it("a first month after the last is refused", () => {
    const { desktop } = open(YEAR, { mode: "month" });
    typeDay(desktop(), "Từ tháng", "06/2026");
    typeDay(desktop(), "Đến tháng", "01/2026");
    expect(desktop().getByText("Tháng đầu phải trước tháng cuối")).toBeInTheDocument();
    expect(desktop().getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  });
});

describe("DateRangeButton -- not a popup (BR-DATA-007)", () => {
  it("uses no overlay, portal or modal", () => {
    const src = readFileSync(join(process.cwd(), "components/ui/DateRangeButton.tsx"), "utf8");
    for (const banned of ["fixed inset-0", "withPortal", "ModalPortal", "FormModal", "createPortal"]) {
      expect(src).not.toContain(banned);
    }
  });
});

// Owner screenshot 2026-10-10 ("Lỗi giao diện"): on Tổng quan the two-month
// calendar and "Đến ngày" ran past the panel's right edge, and the chosen days
// were the calendar library's blue instead of the shop's brown.
describe("DateRangeButton -- the computer panel's look", () => {
  it("grows to fit the presets and the two months instead of a fixed 640px", () => {
    open();
    const panel = screen.getByTestId("range-panel-desktop");
    expect(panel).toHaveClass("w-max");
    expect(panel.className).not.toContain("min-w-[640px]");
  });

  it("the calendar carries the range-calendar class in both modes", () => {
    open();
    expect(screen.getByTestId("range-panel-desktop").querySelector(".react-datepicker.range-calendar")).not.toBeNull();
    cleanup();
    open({ preset: "THIS_YEAR", start: "2026-01", end: "2026-12" }, { mode: "month" });
    expect(screen.getByTestId("range-panel-desktop").querySelector(".react-datepicker.range-calendar")).not.toBeNull();
  });

  it("range-calendar paints chosen days in the shop's colours and the page's font", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const block = (sel: string) => {
      const i = css.indexOf(sel);
      return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
    };
    expect(block(".range-calendar.react-datepicker")).toContain("font-family: inherit");
    expect(block(".range-calendar .react-datepicker__day--in-range")).toContain("var(--color-primary)");
    expect(block(".range-calendar .react-datepicker__day--in-selecting-range")).toContain("var(--color-primary-soft)");
    expect(block(".range-calendar .react-datepicker__month-text--in-range")).toContain("var(--color-primary)");
    expect(css).not.toMatch(/range-calendar[^}]*#216ba5/);
  });
});
