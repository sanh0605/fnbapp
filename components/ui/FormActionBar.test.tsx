// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormActionBar } from "./FormActionBar";

afterEach(cleanup);

describe("BR-UI-015 FormActionBar", () => {
  it("create mode shows buttons 'Tạo' and 'Bỏ'", () => {
    render(
      <form>
        <input />
        <FormActionBar mode="create" onCancel={() => {}} />
      </form>
    );
    expect(screen.getByRole("button", { name: "Tạo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeTruthy();
  });

  it("edit mode shows 'Lưu thay đổi' and 'Bỏ thay đổi'", () => {
    render(
      <form>
        <input />
        <FormActionBar mode="edit" onCancel={() => {}} />
      </form>
    );
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeTruthy();
  });

  it("No 'Có thay đổi chưa lưu' at first; typing in the input shows it", () => {
    render(
      <form>
        <input data-testid="field" />
        <FormActionBar mode="create" onCancel={() => {}} />
      </form>
    );
    expect(screen.queryByText("Có thay đổi chưa lưu")).toBeNull();
    fireEvent.input(screen.getByTestId("field"), { target: { value: "test" } });
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeTruthy();
  });

  it("loading → primary disabled and shows 'Đang lưu…'", () => {
    render(
      <form>
        <input />
        <FormActionBar mode="create" loading onCancel={() => {}} />
      </form>
    );
    const primary = screen.getByRole("button", { name: "Đang lưu…" });
    expect(primary).toBeDisabled();
    expect(screen.getByText("Đang lưu…")).toBeTruthy();
  });

  it("Clicking the secondary button calls onCancel; it is not a submit (form onSubmit not called)", () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input />
        <FormActionBar mode="create" onCancel={onCancel} />
      </form>
    );
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Primary button has type='submit'", () => {
    render(
      <form>
        <input />
        <FormActionBar mode="create" onCancel={() => {}} />
      </form>
    );
    const primary = screen.getByRole("button", { name: "Tạo" });
    expect(primary.getAttribute("type")).toBe("submit");
  });
});
