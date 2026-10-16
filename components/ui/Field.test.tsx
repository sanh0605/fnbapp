// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field, fieldMessageId } from "./Field";
import { TextInput } from "./TextInput";
import { Select } from "./Select";

afterEach(cleanup);

// Spec 2.3: label above the box, grey hint under it, a mistake replaces the hint.
describe("BR-UI-005 Field, TextInput, Select", () => {
  it("ties the label to the box and uses text-sm on the label", () => {
    render(
      <Field label="Tên nhà cung cấp" htmlFor="name">
        <TextInput id="name" />
      </Field>,
    );
    expect(screen.getByLabelText("Tên nhà cung cấp")).toBe(screen.getByRole("textbox"));
    expect(screen.getByText("Tên nhà cung cấp").className).toContain("text-sm");
  });

  it("shows the hint under the box with text-[13px]", () => {
    render(
      <Field label="Ghi chú" htmlFor="note" hint="Không bắt buộc">
        <TextInput id="note" aria-describedby={fieldMessageId("note")} />
      </Field>,
    );
    const hint = screen.getByText("Không bắt buộc");
    expect(hint.id).toBe(fieldMessageId("note"));
    expect(hint.className).toContain("text-[13px]");
  });

  it("a mistake replaces the hint, in an alert with text-[13px]", () => {
    render(
      <Field label="Ghi chú" htmlFor="note" hint="Không bắt buộc" error="Ghi chú quá dài.">
        <TextInput id="note" invalid aria-describedby={fieldMessageId("note")} />
      </Field>,
    );
    expect(screen.queryByText("Không bắt buộc")).not.toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Ghi chú quá dài.");
    expect(alert.className).toContain("text-[13px]");
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
  });

  it("a select marked wrong says so to screen readers", () => {
    render(
      <Field label="Đơn vị" htmlFor="unit" error="Chọn đơn vị.">
        <Select id="unit" invalid defaultValue="">
          <option value="">Chọn</option>
          <option value="ml">ml</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("Đơn vị").getAttribute("aria-invalid")).toBe("true");
  });

  it("text box and select are 48px tall", () => {
    render(
      <>
        <TextInput aria-label="a" />
        <Select aria-label="b">
          <option>x</option>
        </Select>
      </>,
    );
    expect(screen.getByLabelText("a").className).toContain("min-h-[48px]");
    expect(screen.getByLabelText("b").className).toContain("min-h-[48px]");
  });
});

describe("box height by device (owner 2026-10-11 trial)", () => {
  it("text box and select are 48px on a phone and 40px on a computer", () => {
    render(
      <>
        <TextInput aria-label="a" />
        <Select aria-label="b">
          <option>x</option>
        </Select>
      </>,
    );
    for (const label of ["a", "b"]) {
      const cls = screen.getByLabelText(label).className;
      expect(cls).toContain("min-h-[48px]");
      expect(cls).toContain("md:min-h-[40px]");
    }
  });
});
