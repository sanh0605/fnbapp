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

  it("renders the button row without flex-col when extra child buttons are present (one row on phone)", () => {
    render(
      <form>
        <FormActionBar mode="create" onCancel={() => {}}>
          <button type="button">Lưu nháp</button>
        </FormActionBar>
      </form>
    );
    const cancelBtn = screen.getByRole("button", { name: "Bỏ" });
    const buttonRow = cancelBtn.parentElement;
    expect(buttonRow?.className).not.toContain("flex-col");
  });

  it("renders no 'Có thay đổi chưa lưu' element when no change is typed", () => {
    const { container } = render(
      <form>
        <input />
        <FormActionBar mode="create" onCancel={() => {}} />
      </form>
    );
    expect(screen.queryByText("Có thay đổi chưa lưu")).toBeNull();
    expect(container.querySelector(".text-text-muted")).toBeNull();
  });

  it("short form sets marginTop = base + gap to sticky target and preserves result when scrollTop > 0", () => {
    let rectBottom = 400;
    const origGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((elt) => {
      const real = origGetComputedStyle(elt);
      return new Proxy(real, {
        get(target, prop) {
          if (prop === "marginTop") return "16px";
          if (prop === "bottom") return "58px";
          return (target as any)[prop];
        },
      });
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("overflow-y-auto")) {
        return { bottom: 800 } as DOMRect;
      }
      return { bottom: rectBottom } as DOMRect;
    });

    try {
      const { container } = render(
        <div className="overflow-y-auto">
          <form>
            <input />
            <FormActionBar mode="create" onCancel={() => {}} />
          </form>
        </div>
      );

      const bar = container.querySelector(".sticky") as HTMLElement;
      // target = 800 - 58 = 742; currentBottom = 400; diff = 742 - 400 = 342;
      // marginTop = base (16) + diff (342) = 358px
      expect(bar.style.marginTop).toBe("358px");

      // Same result when scrollTop > 0: element moves up by 50px, rect bottom is 350, scrollTop is 50
      const scrollParent = container.querySelector(".overflow-y-auto") as HTMLElement;
      scrollParent.scrollTop = 50;
      rectBottom = 350;
      fireEvent(window, new Event("resize"));
      expect(bar.style.marginTop).toBe("358px");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("subtracts observed element's computed paddingBottom from extra margin (same result when scrollTop > 0)", () => {
    let rectBottom = 400;
    const origGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((elt) => {
      const real = origGetComputedStyle(elt);
      return new Proxy(real, {
        get(target, prop) {
          if (prop === "marginTop") return "16px";
          if (prop === "bottom") return "58px";
          if (prop === "paddingBottom") return "24px";
          return (target as any)[prop];
        },
      });
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("overflow-y-auto")) {
        return { bottom: 800 } as DOMRect;
      }
      return { bottom: rectBottom } as DOMRect;
    });

    try {
      const { container } = render(
        <div className="overflow-y-auto">
          <form>
            <input />
            <FormActionBar mode="create" onCancel={() => {}} />
          </form>
        </div>
      );

      const bar = container.querySelector(".sticky") as HTMLElement;
      // target = 800 - 58 = 742; currentBottom = 400; paddingBottom = 24; diff = 742 - 400 - 24 = 318;
      // marginTop = base (16) + diff (318) = 334px
      expect(bar.style.marginTop).toBe("334px");

      // Same result when scrollTop > 0
      const scrollParent = container.querySelector(".overflow-y-auto") as HTMLElement;
      scrollParent.scrollTop = 50;
      rectBottom = 350;
      fireEvent(window, new Event("resize"));
      expect(bar.style.marginTop).toBe("334px");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("long form (bar already at or below target) sets no marginTop", () => {
    const origGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((elt) => {
      const real = origGetComputedStyle(elt);
      return new Proxy(real, {
        get(target, prop) {
          if (prop === "marginTop") return "16px";
          if (prop === "bottom") return "58px";
          return (target as any)[prop];
        },
      });
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("overflow-y-auto")) {
        return { bottom: 800 } as DOMRect;
      }
      return { bottom: 800 } as DOMRect;
    });

    try {
      const { container } = render(
        <div className="overflow-y-auto">
          <form>
            <input />
            <FormActionBar mode="create" onCancel={() => {}} />
          </form>
        </div>
      );

      const bar = container.querySelector(".sticky") as HTMLElement;
      expect(bar.style.marginTop).toBe("");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("observes scrollParent.firstElementChild if scrollParent exists, otherwise form", () => {
    let observed: Element | null = null;
    const origRO = window.ResizeObserver;
    window.ResizeObserver = class {
      observe(target: Element) {
        observed = target;
      }
      unobserve() {}
      disconnect() {}
    } as any;

    try {
      render(
        <div className="overflow-y-auto">
          <div data-testid="banner">Banner</div>
          <form>
            <FormActionBar mode="create" onCancel={() => {}} />
          </form>
        </div>
      );
      expect(screen.getByTestId("banner")).toBe(observed);
    } finally {
      window.ResizeObserver = origRO;
    }
  });
});
