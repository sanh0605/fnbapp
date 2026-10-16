// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FieldList } from "./FieldList";

afterEach(cleanup);

describe("FieldList", () => {
  it("renders label with text-sm and value with text-base md:text-sm", () => {
    render(
      <FieldList
        fields={[
          { label: "Mã nhà cung cấp", value: "NCC-001" },
        ]}
      />
    );

    const label = screen.getByText("Mã nhà cung cấp");
    const value = screen.getByText("NCC-001");

    expect(label.className).toContain("text-sm");
    expect(value.className).toContain("text-base");
    expect(value.className).toContain("md:text-sm");
  });
});
