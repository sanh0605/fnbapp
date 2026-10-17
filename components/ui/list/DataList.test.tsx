// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { DataList, type DataColumn } from "./DataList";

const { refresh, router } = vi.hoisted(() => {
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  const replaceFn = vi.fn();
  const backFn = vi.fn();
  return {
    refresh: refreshFn,
    router: { refresh: refreshFn, push: pushFn, replace: replaceFn, back: backFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const { confirmMock } = vi.hoisted(() => {
  const confirmFn = vi.fn();
  return { confirmMock: confirmFn };
});

vi.mock("@/lib/shared/dialog", () => ({
  confirm: (...args: any[]) => confirmMock(...args),
}));

interface SampleSupplier {
  id: string;
  name: string;
}

const suppliers: SampleSupplier[] = [
  { id: "NCC-029", name: "Vinamilk" },
  { id: "NCC-020", name: "The Garden Tea & Coffee" },
  { id: "NCC-023", name: "Circle K" },
];

const columns: DataColumn<SampleSupplier>[] = [
  {
    key: "id",
    header: "Mã",
    render: (row) => row.id,
  },
  {
    key: "name",
    header: "Tên",
    render: (row) => row.name,
  },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  refresh.mockClear();
  confirmMock.mockReset();
  router.replace.mockClear();
});

describe("DataList", () => {
  it("ticks 3 items, clicks delete, calls remove sequentially, shows result and refreshes", async () => {
    confirmMock.mockResolvedValue(true);
    const removeMock = vi.fn().mockImplementation(async (id: string) => {
      if (id === "NCC-029") {
        return { error: "Không xoá được Vinamilk: đã có 12 phiếu nhập." };
      }
      return {};
    });

    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} nhà cung cấp đã chọn?`,
          remove: removeMock,
        }}
        empty={<div>Trống</div>}
      />
    );

    // Tick all 3 items via "Chọn tất cả"
    const selectAllCheckbox = screen.getByRole("checkbox", { name: "Chọn tất cả" });
    fireEvent.click(selectAllCheckbox);

    // Click "Xoá 3 dòng đã chọn"
    const deleteBtn = screen.getByRole("button", { name: "Xoá 3 dòng đã chọn" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledTimes(3);
    });

    expect(removeMock).toHaveBeenNthCalledWith(1, "NCC-029");
    expect(removeMock).toHaveBeenNthCalledWith(2, "NCC-020");
    expect(removeMock).toHaveBeenNthCalledWith(3, "NCC-023");

    expect(screen.getByText("Đã xoá 2 dòng.")).toBeInTheDocument();
    expect(
      screen.getByText("Không xoá được Vinamilk: đã có 12 phiếu nhập.")
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("calls confirm when clicking trash icon for Circle K, but cancels if confirm returns false", async () => {
    confirmMock.mockResolvedValue(false);
    const removeMock = vi.fn();

    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} nhà cung cấp đã chọn?`,
          remove: removeMock,
        }}
        empty={<div>Trống</div>}
      />
    );

    const binBtn = screen.getAllByRole("button", { name: "Xoá Circle K" })[0];
    fireEvent.click(binBtn);

    expect(confirmMock).toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("omits checkboxes and delete buttons when removal is not provided", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        empty={<div>Trống</div>}
      />
    );

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Xoá/ })).toBeNull();
  });

  it("renders row links with getHref", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        empty={<div>Trống</div>}
      />
    );

    const vinamilkLinks = screen.getAllByRole("link", { name: /Vinamilk/ });
    expect(
      vinamilkLinks.some((l) => l.getAttribute("href") === "/admin/suppliers/NCC-029")
    ).toBe(true);
  });

  it("ensures checkboxes are not inside anchor tags", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} dòng?`,
          remove: vi.fn(),
        }}
        empty={<div>Trống</div>}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const cb of checkboxes) {
      expect(cb.closest("a")).toBeNull();
    }
  });

  it("rowVerb: two rows, rowVerb returns 'Ngừng dùng' for row A and 'Xoá' for row B -> bins have aria-labels 'Ngừng dùng A' and 'Xoá B'", () => {
    const twoRows: SampleSupplier[] = [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
    ];

    render(
      <DataList
        rows={twoRows}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá",
          rowVerb: (row: SampleSupplier) => (row.id === "A" ? "Ngừng dùng" : "Xoá"),
          confirmMessage: (count) => `Xoá ${count} dòng?`,
          remove: vi.fn(),
        }}
        empty={<div>Trống</div>}
      />
    );

    const aBins = screen.getAllByRole("button", { name: "Ngừng dùng A" });
    const bBins = screen.getAllByRole("button", { name: "Xoá B" });
    expect(aBins.length).toBeGreaterThan(0);
    expect(bBins.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Xoá A" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ngừng dùng B" })).toBeNull();
  });

  it("mixed bulk: select 3 rows, remove resolves {deactivated:true} for one, {} for two -> status text contains 'Đã xoá 2 dòng. Đã ngừng dùng 1 dòng.'", async () => {
    confirmMock.mockResolvedValue(true);
    const removeMock = vi.fn().mockImplementation(async (id: string) => {
      if (id === "NCC-029") {
        return { deactivated: true };
      }
      return {};
    });

    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} nhà cung cấp đã chọn?`,
          remove: removeMock,
        }}
        empty={<div>Trống</div>}
      />
    );

    // Tick all 3 items via "Chọn tất cả"
    const selectAllCheckbox = screen.getByRole("checkbox", { name: "Chọn tất cả" });
    fireEvent.click(selectAllCheckbox);

    // Click "Xoá 3 dòng đã chọn"
    const deleteBtn = screen.getByRole("button", { name: "Xoá 3 dòng đã chọn" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledTimes(3);
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Đã xoá 2 dòng. Đã ngừng dùng 1 dòng.");
  });

  it("all deactivated: 2 rows both deactivated -> 'Đã ngừng dùng 2 dòng.' and does NOT contain 'Đã xoá'", async () => {
    confirmMock.mockResolvedValue(true);
    const removeMock = vi.fn().mockResolvedValue({ deactivated: true });

    render(
      <DataList
        rows={suppliers.slice(0, 2)}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} nhà cung cấp đã chọn?`,
          remove: removeMock,
        }}
        empty={<div>Trống</div>}
      />
    );

    // Tick both items via "Chọn tất cả"
    const selectAllCheckbox = screen.getByRole("checkbox", { name: "Chọn tất cả" });
    fireEvent.click(selectAllCheckbox);

    // Click "Xoá 2 dòng đã chọn"
    const deleteBtn = screen.getByRole("button", { name: "Xoá 2 dòng đã chọn" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledTimes(2);
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Đã ngừng dùng 2 dòng.");
    expect(status.textContent).not.toContain("Đã xoá");
  });

  it("per-row verb list, nothing deactivated -> 'Đã xoá 2 dòng.', not the list-wide verb", async () => {
    confirmMock.mockResolvedValue(true);
    const removeMock = vi.fn().mockResolvedValue({});

    render(
      <DataList
        rows={suppliers.slice(0, 2)}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        removal={{
          verb: "Xoá hoặc ngừng dùng",
          rowVerb: () => "Xoá",
          confirmMessage: (count) => `Xoá hoặc ngừng dùng ${count} dòng?`,
          remove: removeMock,
        }}
        empty={<div>Trống</div>}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả" }));
    fireEvent.click(screen.getByRole("button", { name: "Xoá hoặc ngừng dùng 2 dòng đã chọn" }));

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledTimes(2);
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Đã xoá 2 dòng.");
    expect(status.textContent).not.toContain("Đã xoá hoặc ngừng dùng");
  });

  describe("sorting (BR-DATA-008)", () => {
    const sortColumns = [
      {
        key: "id",
        header: "Mã",
        render: (row: SampleSupplier) => row.id,
        sortValue: (row: SampleSupplier) => row.id,
      },
      {
        key: "name",
        header: "Tên",
        render: (row: SampleSupplier) => row.name,
        sortValue: (row: SampleSupplier) => row.name,
      },
      {
        key: "notes",
        header: "Ghi chú",
        render: () => "---",
      },
    ];

    it("renders column headers with sort links, arrow ▲, and aria-sort='ascending' when active sort is asc", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={sortColumns as any}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          empty={<div>Trống</div>}
          {...({
            sort: {
              key: "id",
              dir: "asc",
              href: (key: string, dir: string) => `/admin/suppliers?sort=${key}&dir=${dir}`,
            },
          } as any)}
        />
      );

      // Active column: id (asc)
      const idTh = screen.getByRole("columnheader", { name: /Mã/i });
      expect(idTh).toHaveAttribute("aria-sort", "ascending");
      expect(idTh.textContent).toContain("▲");
      const idLink = idTh.querySelector("a");
      expect(idLink).not.toBeNull();
      // Clicking active asc column should toggle to desc
      expect(idLink?.getAttribute("href")).toBe("/admin/suppliers?sort=id&dir=desc");

      // Inactive sortable column: name
      const nameTh = screen.getByRole("columnheader", { name: /Tên/i });
      expect(nameTh).not.toHaveAttribute("aria-sort", "ascending");
      expect(nameTh).not.toHaveAttribute("aria-sort", "descending");
      expect(nameTh.textContent).not.toContain("▲");
      expect(nameTh.textContent).not.toContain("▼");
      const nameLink = nameTh.querySelector("a");
      expect(nameLink).not.toBeNull();
      // Clicking inactive column should sort asc
      expect(nameLink?.getAttribute("href")).toBe("/admin/suppliers?sort=name&dir=asc");

      // Non-sortable column
      const unsortableTh = screen.getByRole("columnheader", { name: /Ghi chú/i });
      expect(unsortableTh).not.toHaveAttribute("aria-sort");
      expect(unsortableTh.querySelector("a")).toBeNull();
    });

    it("renders column header with arrow ▼, and aria-sort='descending' when active sort is desc", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={sortColumns as any}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          empty={<div>Trống</div>}
          {...({
            sort: {
              key: "id",
              dir: "desc",
              href: (key: string, dir: string) => `/admin/suppliers?sort=${key}&dir=${dir}`,
            },
          } as any)}
        />
      );

      const idTh = screen.getByRole("columnheader", { name: /Mã/i });
      expect(idTh).toHaveAttribute("aria-sort", "descending");
      expect(idTh.textContent).toContain("▼");
      const idLink = idTh.querySelector("a");
      expect(idLink).not.toBeNull();
      // Clicking active desc column should toggle back to asc
      expect(idLink?.getAttribute("href")).toBe("/admin/suppliers?sort=id&dir=asc");
    });

    it("renders phone layout sort select with all sortable column options and navigates on change", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={sortColumns as any}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          empty={<div>Trống</div>}
          {...({
            sort: {
              key: "id",
              dir: "asc",
              href: (key: string, dir: string) => `/admin/suppliers?sort=${key}&dir=${dir}`,
            },
          } as any)}
        />
      );

      const select = screen.getByRole("combobox", { name: "Sắp xếp" }) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.className).toContain("min-h-[48px]");
      expect(select.className).toContain("appearance-none");
      expect(select.className).toContain("rounded-button");
      const chevron = select.parentElement?.querySelector("svg");
      expect(chevron).toBeInTheDocument();
      expect(chevron?.querySelector("path")).toHaveAttribute("d", "M19 9l-7 7-7-7");

      const options = Array.from(select.querySelectorAll("option"));
      const optionTexts = options.map((o) => o.textContent?.trim());

      // Each sortable column has both 'tăng dần' and 'giảm dần'
      expect(optionTexts).toContain("Mã tăng dần");
      expect(optionTexts).toContain("Mã giảm dần");
      expect(optionTexts).toContain("Tên tăng dần");
      expect(optionTexts).toContain("Tên giảm dần");

      // Column without sortValue is not in select options
      expect(optionTexts.some((t) => t?.includes("Ghi chú"))).toBe(false);

      // Select 'Tên giảm dần' and verify router.replace is called
      const nameDescOpt = options.find((o) => o.textContent?.includes("Tên giảm dần"));
      expect(nameDescOpt).toBeDefined();

      fireEvent.change(select, { target: { value: nameDescOpt!.value } });
      expect(router.replace).toHaveBeenCalledWith("/admin/suppliers?sort=name&dir=desc");
    });
  });

  describe("canRemove (selective row removal)", () => {
    it("with canRemove excluding one row: excluded row has no checkbox and no bin button; tick-all ticks every other row and the bar reads 'Xoá 2 dòng đã chọn'; remove is never called with the excluded id", async () => {
      confirmMock.mockResolvedValue(true);
      const removeMock = vi.fn().mockResolvedValue({});

      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={columns}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          removal={{
            verb: "Xoá",
            confirmMessage: (count) => `Xoá ${count} dòng đã chọn?`,
            remove: removeMock,
            canRemove: (r: SampleSupplier) => r.id !== "NCC-020",
          }}
          empty={<div>Trống</div>}
        />
      );

      expect(screen.queryByRole("checkbox", { name: "Chọn The Garden Tea & Coffee" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Xoá The Garden Tea & Coffee" })).toBeNull();

      expect(screen.getAllByRole("checkbox", { name: "Chọn Vinamilk" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("checkbox", { name: "Chọn Circle K" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Xoá Vinamilk" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Xoá Circle K" }).length).toBeGreaterThan(0);

      const selectAll = screen.getByRole("checkbox", { name: "Chọn tất cả" });
      fireEvent.click(selectAll);

      const deleteSelectedBtn = screen.getByRole("button", { name: "Xoá 2 dòng đã chọn" });
      expect(deleteSelectedBtn).toBeInTheDocument();

      fireEvent.click(deleteSelectedBtn);

      await waitFor(() => {
        expect(removeMock).toHaveBeenCalledTimes(2);
      });

      expect(removeMock).toHaveBeenCalledWith("NCC-029");
      expect(removeMock).toHaveBeenCalledWith("NCC-023");
      expect(removeMock).not.toHaveBeenCalledWith("NCC-020");
    });

    it("without canRemove every row still has a checkbox", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={columns}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          removal={{
            verb: "Xoá",
            confirmMessage: (count) => `Xoá ${count} dòng đã chọn?`,
            remove: vi.fn(),
          }}
          empty={<div>Trống</div>}
        />
      );

      expect(screen.getAllByRole("checkbox", { name: "Chọn Vinamilk" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("checkbox", { name: "Chọn The Garden Tea & Coffee" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("checkbox", { name: "Chọn Circle K" }).length).toBeGreaterThan(0);
    });

    it("hides header checkbox (tick-all) when the page has no removable row", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={columns}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          removal={{
            verb: "Xoá",
            confirmMessage: (count) => `Xoá ${count} dòng đã chọn?`,
            remove: vi.fn(),
            canRemove: () => false,
          }}
          empty={<div>Trống</div>}
        />
      );

      expect(screen.queryByRole("checkbox", { name: "Chọn tất cả" })).toBeNull();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("with every row excluded by canRemove, there is no button named 'Chọn'", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={columns}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          removal={{
            verb: "Xoá",
            confirmMessage: (count) => `Xoá ${count} dòng đã chọn?`,
            remove: vi.fn(),
            canRemove: () => false,
          }}
          empty={<div>Trống</div>}
        />
      );

      expect(screen.queryByRole("button", { name: "Chọn" })).toBeNull();
    });

    it("with one removable row, the 'Chọn' button exists", () => {
      render(
        <DataList
          rows={suppliers}
          getId={(r: SampleSupplier) => r.id}
          getName={(r: SampleSupplier) => r.name}
          getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
          columns={columns}
          phoneRow={(r: SampleSupplier) => ({ title: r.name })}
          removal={{
            verb: "Xoá",
            confirmMessage: (count) => `Xoá ${count} dòng đã chọn?`,
            remove: vi.fn(),
            canRemove: (r: SampleSupplier) => r.id === "NCC-020",
          }}
          empty={<div>Trống</div>}
        />
      );

      expect(screen.getByRole("button", { name: "Chọn" })).toBeInTheDocument();
    });
  });
});



// BR-UI-005 / BR-UI-003, spec 2.4: plain grey headers, even rows, a place for
// the totals row right under the header (what gets totalled is BR-UI-004).
describe("DataList wears the table template", () => {
  function renderList(extra: Partial<React.ComponentProps<typeof DataList<SampleSupplier>>> = {}) {
    return render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({ title: r.name })}
        empty={<div>Trống</div>}
        {...extra}
      />
    );
  }

  it("headers are plain grey text, not capitals", () => {
    renderList();
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.className).not.toMatch(/\buppercase\b|\btracking-/);
      expect((th.closest("tr") as HTMLElement).className).not.toMatch(/\buppercase\b|\btracking-/);
    }
  });

  it("titles are bold and on the left, an amount column's too; its figures stay right (BR-UI-011)", () => {
    renderList({
      columns: [
        ...columns,
        { key: "debt", header: "Công nợ", align: "right", render: () => "120,000đ" },
      ],
    });
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.className).toMatch(/\bfont-(semibold|bold)\b/);
      expect(th.className).not.toMatch(/\bfont-medium\b/);
      expect(th.className).not.toContain("text-right");
    }
    expect(screen.getAllByText("120,000đ")[0].closest("td")!.className).toContain("text-right");
  });

  it("a sortable amount column's title link sits on the left too (BR-UI-011)", () => {
    renderList({
      columns: [
        ...columns,
        { key: "debt", header: "Công nợ", align: "right", render: () => "120,000đ", sortValue: () => 1 },
      ],
      sort: { key: "id", dir: "asc", href: (k, d) => `?sort=${k}&dir=${d}` },
    });
    const link = screen.getByRole("link", { name: /Công nợ/ });
    expect(link.className).not.toContain("justify-end");
  });

  it("a computer row is about 45px tall, with or without its delete button (owner 2026-10-11 trial)", () => {
    renderList({
      removal: { verb: "Xoá", confirmMessage: (n: number) => `Xoá ${n}?`, remove: vi.fn() },
    });
    const row = screen.getAllByText("Vinamilk")[0].closest("tr") as HTMLElement;
    for (const td of Array.from(row.querySelectorAll("td"))) {
      expect(td.className).not.toMatch(/\bpy-4\b/);
    }
    expect(screen.getAllByText("Vinamilk")[0].closest("td")!.className).toMatch(/\bpy-3\b/);
    const del = screen.getAllByRole("button", { name: "Xoá Vinamilk" }).find(b => b.closest("td"))!;
    expect(del.className).toContain("min-h-[32px]");
    expect(del.className).not.toContain("min-h-[36px]");
    expect((del.closest("td") as HTMLElement).className).toMatch(/\bpy-1\.5\b/);
  });

  it("no row cell is bold", () => {
    renderList();
    for (const td of screen.getAllByRole("cell")) {
      expect(td.className).not.toMatch(/\bfont-(bold|semibold|medium)\b/);
    }
  });

  it("no totals row unless the page gives totals", () => {
    renderList();
    expect(screen.queryByText("Tổng")).not.toBeInTheDocument();
  });

  it("with totals: a soft brown row right under the header, and a strip on the phone", () => {
    renderList({ totals: { label: "Tổng", values: { name: "3 nhà cung cấp" } } });
    const rows = screen.getAllByRole("row");
    expect(rows[1].className).toContain("bg-primary-soft");
    expect(rows[1]).toHaveTextContent("Tổng");
    expect(rows[1]).toHaveTextContent("3 nhà cung cấp");

    // The phone list comes after the desktop table in the page; its
    // totals strip reads "<label>: <value>" and comes before its first row.
    const phoneTotal = screen.getByText("Tổng: 3 nhà cung cấp");
    expect(phoneTotal.closest(".md\\:hidden")).not.toBeNull();
    const vinamilks = screen.getAllByText("Vinamilk");
    const phoneFirstRow = vinamilks[vinamilks.length - 1];
    expect(phoneTotal.compareDocumentPosition(phoneFirstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("totals label cell on desktop has whitespace-nowrap", () => {
    renderList({ totals: { label: "Tổng (không tính huỷ)", values: { name: "3 nhà cung cấp" } } });
    const labelCell = screen.getByText("Tổng (không tính huỷ)").closest("td");
    expect(labelCell?.className).toContain("whitespace-nowrap");
  });

  it("multi-value totals strip joins items with · on the phone", () => {
    renderList({
      totals: {
        label: "Tổng",
        values: { id: "3", name: "3 nhà cung cấp" },
      },
    });
    const phoneTotal = screen.getByText("Tổng: Mã 3 · Tên 3 nhà cung cấp");
    expect(phoneTotal.closest(".md\\:hidden")).not.toBeNull();
  });

  it("the bulk delete button is a red outline, since a yes/no question follows it", () => {
    renderList({
      removal: {
        verb: "Xoá",
        confirmMessage: (count: number) => `Xoá ${count} nhà cung cấp đã chọn?`,
        remove: vi.fn(),
      },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả" }));
    const cls = screen.getByRole("button", { name: "Xoá 3 dòng đã chọn" }).className.split(/\s+/);
    expect(cls).toContain("border-danger");
    expect(cls).not.toContain("bg-danger");
  });
});

describe("DataList phoneRow (BR-UI-018)", () => {
  it("renders each phone row as a link to getHref(row)", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({
          title: r.name,
          value: "1,000đ",
          meta: r.id,
        })}
        empty={<div>Trống</div>}
      />
    );

    const phoneTitle = screen.getAllByText("Vinamilk").find((el) => el.closest(".md\\:hidden"))!;
    expect(phoneTitle).toBeDefined();
    const phoneContainer = phoneTitle.closest(".md\\:hidden") as HTMLElement;

    for (const s of suppliers) {
      const rowTitle = within(phoneContainer).getByText(s.name);
      const link = rowTitle.closest("a");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe(`/admin/suppliers/${s.id}`);
    }
  });

  it("renders no delete button inside the phone layout (.md\\:hidden)", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({
          title: r.name,
          meta: r.id,
        })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} dòng?`,
          remove: vi.fn(),
        }}
        empty={<div>Trống</div>}
      />
    );

    const phoneTitle = screen.getAllByText("Vinamilk").find((el) => el.closest(".md\\:hidden"))!;
    expect(phoneTitle).toBeDefined();
    const phoneContainer = phoneTitle.closest(".md\\:hidden") as HTMLElement;
    expect(within(phoneContainer).queryByRole("button", { name: /^Xoá/ })).toBeNull();
  });

  it("in select mode, clicking the row title toggles its checkbox once per click, and omits checkbox when canRemove is false", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({
          title: r.name,
          meta: r.id,
        })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} dòng?`,
          remove: vi.fn(),
          canRemove: (r: SampleSupplier) => r.id !== "NCC-020",
        }}
        empty={<div>Trống</div>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Chọn" }));

    const phoneTitle = screen.getAllByText("Circle K").find((el) => el.closest(".md\\:hidden"))!;
    expect(phoneTitle).toBeDefined();
    expect(phoneTitle.closest("a")).toBeNull();
    const phoneContainer = phoneTitle.closest(".md\\:hidden") as HTMLElement;

    const checkbox = within(phoneContainer).getByRole("checkbox", { name: "Chọn Circle K" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(phoneTitle);
    expect(checkbox).toBeChecked();

    fireEvent.click(phoneTitle);
    expect(checkbox).not.toBeChecked();

    expect(
      within(phoneContainer).queryByRole("checkbox", { name: "Chọn The Garden Tea & Coffee" })
    ).toBeNull();
  });

  it("shows a sticky bulk delete bar in select mode", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        phoneRow={(r: SampleSupplier) => ({
          title: r.name,
          meta: r.id,
        })}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} dòng?`,
          remove: vi.fn(),
        }}
        empty={<div>Trống</div>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Chọn" }));
    const phoneTitle = screen.getAllByText("Circle K").find((el) => el.closest(".md\\:hidden"))!;
    fireEvent.click(phoneTitle);

    const deleteBtn = screen.getByRole("button", { name: "Xoá 1 dòng đã chọn" });
    expect(deleteBtn.closest(".sticky")).not.toBeNull();
  });
});

