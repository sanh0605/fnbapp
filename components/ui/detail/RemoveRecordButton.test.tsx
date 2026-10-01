// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { RemoveRecordButton } from "./RemoveRecordButton";
import { FieldList } from "./FieldList";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const { confirmMock } = vi.hoisted(() => {
  const confirmFn = vi.fn();
  return { confirmMock: confirmFn };
});

vi.mock("@/lib/shared/dialog", () => ({
  confirm: (...args: any[]) => confirmMock(...args),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  confirmMock.mockReset();
});

describe("FieldList", () => {
  it("renders '—' for empty string value", () => {
    render(<FieldList fields={[{ label: "Mã số thuế", value: "" }]} />);
    expect(screen.getByText("Mã số thuế")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders '—' for null or undefined value", () => {
    render(
      <FieldList
        fields={[
          { label: "Ghi chú", value: null },
          { label: "Địa chỉ", value: undefined },
        ]}
      />
    );
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(2);
  });

  it("renders non-empty value correctly", () => {
    render(<FieldList fields={[{ label: "Tên", value: "Vinamilk" }]} />);
    expect(screen.getByText("Vinamilk")).toBeInTheDocument();
  });
});

describe("RemoveRecordButton", () => {
  it("shows error and does not call push when remove returns an error", async () => {
    confirmMock.mockResolvedValue(true);
    const removeMock = vi.fn().mockResolvedValue({
      error: "Không xoá được Vinamilk: đã có 12 phiếu nhập.",
    });

    render(
      <RemoveRecordButton
        verb="Xoá"
        name="Vinamilk"
        confirmMessage="Xoá nhà cung cấp này?"
        remove={removeMock}
        afterHref="/admin/suppliers"
      />
    );

    const deleteBtn = screen.getByRole("button", { name: "Xoá" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith({
        title: "Xoá",
        message: "Xoá nhà cung cấp này?",
        variant: "danger",
      });
      expect(removeMock).toHaveBeenCalledTimes(1);
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không xoá được Vinamilk: đã có 12 phiếu nhập.");
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("calls push(afterHref) and refresh() when remove succeeds with {}", async () => {
    confirmMock.mockResolvedValue(true);
    const removeMock = vi.fn().mockResolvedValue({});

    render(
      <RemoveRecordButton
        verb="Xoá"
        name="Circle K"
        confirmMessage="Xoá nhà cung cấp này?"
        remove={removeMock}
        afterHref="/admin/suppliers"
      />
    );

    const deleteBtn = screen.getByRole("button", { name: "Xoá" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(removeMock).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/admin/suppliers");
      expect(refresh).toHaveBeenCalled();
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not call remove if confirm is cancelled", async () => {
    confirmMock.mockResolvedValue(false);
    const removeMock = vi.fn();

    render(
      <RemoveRecordButton
        verb="Xoá"
        name="Circle K"
        confirmMessage="Xoá nhà cung cấp này?"
        remove={removeMock}
        afterHref="/admin/suppliers"
      />
    );

    const deleteBtn = screen.getByRole("button", { name: "Xoá" });
    fireEvent.click(deleteBtn);

    expect(confirmMock).toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
