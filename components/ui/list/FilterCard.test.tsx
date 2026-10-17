// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterCard } from "./FilterCard";

afterEach(cleanup);

describe("FilterCard phone fold and search", () => {
  it("shows 'Bộ lọc (2)' when activeCount is 2 and 'Bộ lọc' when activeCount is 0", () => {
    const { rerender } = render(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        activeCount={2}
        onApply={vi.fn()}
        onClear={vi.fn()}
        showClear={true}
      >
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    expect(screen.getByRole("button", { name: "Bộ lọc (2)" })).toBeInTheDocument();

    rerender(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        activeCount={0}
        onApply={vi.fn()}
        onClear={vi.fn()}
        showClear={false}
      >
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument();
  });

  it("hides the children wrapper with class 'hidden' before clicking the toggle and reveals it after, while keeping children in the DOM", () => {
    render(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        activeCount={1}
        onApply={vi.fn()}
        onClear={vi.fn()}
        showClear={true}
      >
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    const child = screen.getByLabelText("Trạng thái");
    expect(child).toBeInTheDocument();
    const wrapper = child.parentElement as HTMLElement;
    expect(wrapper.className).toContain("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc (1)" }));

    expect(screen.getByLabelText("Trạng thái")).toBeInTheDocument();
    expect(wrapper.className).not.toContain("hidden");
  });

  it("calls onApply when pressing Enter inside the search input", () => {
    const onApply = vi.fn();
    render(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        activeCount={0}
        onApply={onApply}
        onClear={vi.fn()}
        showClear={false}
      >
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    const searchInputs = screen.getAllByLabelText("Tìm kiếm");
    fireEvent.keyDown(searchInputs[0], { key: "Enter" });
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("renders no 'Bộ lọc' button and does not hide children when neither search nor activeCount is given", () => {
    render(
      <FilterCard onApply={vi.fn()} onClear={vi.fn()} showClear={false}>
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    expect(screen.queryByRole("button", { name: /^Bộ lọc/ })).toBeNull();
    const child = screen.getByLabelText("Trạng thái");
    expect(child.closest(".hidden")).toBeNull();
  });

  it("renders no 'Bộ lọc' button when search is given without children", () => {
    render(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        onApply={vi.fn()}
        onClear={vi.fn()}
        showClear={false}
      >
        {null}
      </FilterCard>,
    );

    expect(screen.getAllByLabelText("Tìm kiếm").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Bộ lọc/ })).toBeNull();
  });

  it("renders 'Lọc' in the same row element as search when search is given without children", () => {
    render(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        onApply={vi.fn()}
        onClear={vi.fn()}
        showClear={false}
      >
        {null}
      </FilterCard>,
    );

    const searchInput = screen.getByLabelText("Tìm kiếm");
    const applyBtn = screen.getByRole("button", { name: "Lọc" });
    const searchRow = searchInput.parentElement?.parentElement;
    expect(searchRow).toContainElement(applyBtn);
  });

  it("renders 'Lọc' outside the search row element when filter children are present", () => {
    render(
      <FilterCard
        search={<input aria-label="Tìm kiếm" />}
        onApply={vi.fn()}
        onClear={vi.fn()}
        showClear={false}
      >
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    const searchInput = screen.getByLabelText("Tìm kiếm");
    const applyBtn = screen.getByRole("button", { name: "Lọc" });
    const searchRow = searchInput.parentElement?.parentElement;
    expect(searchRow).not.toContainElement(applyBtn);
  });

  it("renders no 'Lọc' button when onApply is not passed, while keeping 'Xoá lọc' when showClear is true", () => {
    render(
      <FilterCard onClear={vi.fn()} showClear={true}>
        <select aria-label="Trạng thái">
          <option>Tất cả</option>
        </select>
      </FilterCard>,
    );

    expect(screen.queryByRole("button", { name: "Lọc" })).toBeNull();
    expect(screen.getByRole("button", { name: "Xoá lọc" })).toBeInTheDocument();
  });
});
