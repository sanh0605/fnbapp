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

  it("submitLabel replaces default primary button label, but shows 'Đang lưu…' while loading", () => {
    const { rerender } = render(
      <form>
        <FormActionBar mode="create" submitLabel="Xác nhận" onCancel={() => {}} />
      </form>
    );
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo" })).toBeNull();

    rerender(
      <form>
        <FormActionBar mode="create" submitLabel="Xác nhận" loading onCancel={() => {}} />
      </form>
    );
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận" })).toBeNull();
  });

  it("disabled prop disables the submit button", () => {
    const { rerender } = render(
      <form>
        <FormActionBar mode="create" disabled={true} onCancel={() => {}} />
      </form>
    );
    expect(screen.getByRole("button", { name: "Tạo" })).toBeDisabled();

    rerender(
      <form>
        <FormActionBar mode="create" disabled={false} onCancel={() => {}} />
      </form>
    );
    expect(screen.getByRole("button", { name: "Tạo" })).not.toBeDisabled();
  });

  it("onSubmit prop sets submit button type='button' and calls onSubmit on click", () => {
    const onSubmit = vi.fn();
    render(
      <div>
        <FormActionBar mode="create" onSubmit={onSubmit} onCancel={() => {}} />
      </div>
    );
    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    expect(submitBtn.getAttribute("type")).toBe("button");

    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("children prop renders extra buttons between cancel and submit buttons", () => {
    render(
      <form>
        <FormActionBar mode="create" onCancel={() => {}}>
          <button type="button">Lưu nháp</button>
        </FormActionBar>
      </form>
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(["Bỏ", "Lưu nháp", "Tạo"]);
  });
});

