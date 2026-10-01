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
        getId={(r) => r.id}
        getName={(r) => r.name}
        getHref={(r) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r) => <div>{r.name}</div>}
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
        getId={(r) => r.id}
        getName={(r) => r.name}
        getHref={(r) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r) => <div>{r.name}</div>}
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
        getId={(r) => r.id}
        getName={(r) => r.name}
        getHref={(r) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r) => <div>{r.name}</div>}
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
        getId={(r) => r.id}
        getName={(r) => r.name}
        getHref={(r) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r) => <div>{r.name}</div>}
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
        getId={(r) => r.id}
        getName={(r) => r.name}
        getHref={(r) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r) => <div>{r.name}</div>}
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
        getId={(r) => r.id}
        getName={(r) => r.name}
        getHref={(r) => `/admin/suppliers/${r.id}`}
        columns={columns}
        renderCard={(r) => <div>{r.name}</div>}
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
});
