// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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

  it("after clicking Chọn, clicking the card text of Circle K ticks Chọn Circle K and has no link around it", () => {
    render(
      <DataList
        rows={suppliers}
        getId={(r: SampleSupplier) => r.id}
        getName={(r: SampleSupplier) => r.name}
        getHref={(r: SampleSupplier) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
        removal={{
          verb: "Xoá",
          confirmMessage: (count) => `Xoá ${count} dòng?`,
          remove: vi.fn(),
        }}
        empty={<div>Trống</div>}
      />
    );

    // Click "Chọn" to enter mobile select mode
    const selectModeBtn = screen.getByRole("button", { name: "Chọn" });
    fireEvent.click(selectModeBtn);

    // jsdom renders both layouts; the phone card's tick box is the last one.
    const ticks = screen.getAllByRole("checkbox", { name: "Chọn Circle K" });
    const checkbox = ticks[ticks.length - 1];
    expect(checkbox).not.toBeChecked();

    // The mobile card text of Circle K
    const circleKMatches = screen.getAllByText("Circle K");
    const mobileCardText = circleKMatches[circleKMatches.length - 1];
    expect(mobileCardText.closest("a")).toBeNull();

    // Clicking the card text ticks the checkbox
    fireEvent.click(mobileCardText);
    expect(checkbox).toBeChecked();
    expect(mobileCardText.closest("a")).toBeNull();
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
        renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
      expect(select.className).toContain("min-h-[44px]");

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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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
          renderCard={(r: SampleSupplier) => <div>{r.name}</div>}
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


