// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { OutletDetailView } from "./OutletDetailView";
import { retireOutlet, reactivateOutlet } from "@/app/admin/outlets/actions";
import { confirm } from "@/lib/shared/dialog";
import type { DBOutlet } from "@/types/db";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/outlets/actions", () => ({
  retireOutlet: vi.fn(),
  reactivateOutlet: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

const sampleOutlet: DBOutlet = {
  id: "OUT-001",
  code: "001",
  name: "Điểm bán 1",
  brand_id: "BR-001",
  address: "123 Đường ABC",
  status: "ACTIVE",
  start_date: "2026-03-27",
  end_date: null,
  open_time: "07:00:00",
  close_time: "22:00:00",
  created_at: "",
  updated_at: "",
};

describe("OutletDetailView", () => {
  it("renders fields properly", () => {
    render(
      <OutletDetailView
        outlet={sampleOutlet}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(screen.getByText("OUT-001")).toHaveClass("text-text-secondary");
    expect(screen.getAllByText("Điểm bán 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phin Đi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("123 Đường ABC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("07:00 - 22:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("27/03/2026 00:00:00").length).toBeGreaterThan(0);
    expect(screen.queryByText("Trạng thái")).toBeNull();
    expect(screen.queryByText("Mã")).toBeNull();
    expect(screen.queryByText("Tên")).toBeNull();
  });

  it("shows no Kết thúc when outlet end_date is not set, and shows formatted date when set", () => {
    const { unmount } = render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, end_date: null }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );
    expect(screen.queryByText("Kết thúc")).toBeNull();
    unmount();

    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, end_date: "2026-10-15T15:00:00Z" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );
    expect(screen.getByText("Kết thúc")).toBeInTheDocument();
    expect(screen.getByText("15/10/2026 22:00:00")).toBeInTheDocument();
  });

  it("shows Ngừng hoạt động button and hides Mở lại hoạt động when ACTIVE", () => {
    render(
      <OutletDetailView
        outlet={sampleOutlet}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Ngừng hoạt động" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mở lại hoạt động" }),
    ).toBeNull();
  });

  it("shows Mở lại hoạt động button and hides Ngừng hoạt động when INACTIVE and shows badge", () => {
    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, status: "INACTIVE" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Mở lại hoạt động" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ngừng hoạt động" }),
    ).toBeNull();
    expect(screen.getAllByText("Ngừng hoạt động").length).toBeGreaterThan(0);
  });

  it("with a stopped record, 'Ngừng hoạt động' appears exactly once and 'Trạng thái' is not in the field list", () => {
    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, status: "INACTIVE" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(screen.getAllByText("Ngừng hoạt động")).toHaveLength(1);
    expect(screen.queryByText("Trạng thái")).toBeNull();
  });

  it("calls reactivateOutlet with outlet id and refreshes page on confirmed reactivation", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(reactivateOutlet).mockResolvedValue({ success: true });

    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, status: "INACTIVE" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở lại hoạt động" }));

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Mở lại hoạt động điểm bán",
          okText: "Mở lại hoạt động",
          cancelText: "Huỷ",
        }),
      );
      expect(reactivateOutlet).toHaveBeenCalled();
      const calledFd = vi.mocked(reactivateOutlet).mock.calls[0][0];
      expect(calledFd.get("id")).toBe("OUT-001");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("does not call reactivateOutlet when reactivation confirmation is cancelled", async () => {
    vi.mocked(confirm).mockResolvedValue(false);

    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, status: "INACTIVE" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở lại hoạt động" }));

    await waitFor(() => {
      expect(confirm).toHaveBeenCalled();
      expect(reactivateOutlet).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("shows Vietnamese error message in Alert when reactivateOutlet fails", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(reactivateOutlet).mockResolvedValue({ error: "Điểm bán này đang hoạt động" });

    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, status: "INACTIVE" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở lại hoạt động" }));

    await waitFor(() => {
      expect(screen.getByText("Điểm bán này đang hoạt động")).toBeInTheDocument();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("calls retireOutlet with outlet id and refreshes page on confirmed retirement", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(retireOutlet).mockResolvedValue({ success: true });

    render(
      <OutletDetailView
        outlet={sampleOutlet}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ngừng hoạt động" }));

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Ngừng hoạt động điểm bán",
          okText: "Ngừng hoạt động",
          cancelText: "Huỷ",
        }),
      );
      expect(retireOutlet).toHaveBeenCalled();
      const calledFd = vi.mocked(retireOutlet).mock.calls[0][0];
      expect(calledFd.get("id")).toBe("OUT-001");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows Vietnamese error message in Alert when retireOutlet fails", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(retireOutlet).mockResolvedValue({
      error: "Không thể ngừng hoạt động điểm bán cuối cùng đang hoạt động -- sẽ không còn điểm bán nào để mở máy POS",
    });

    render(
      <OutletDetailView
        outlet={sampleOutlet}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ngừng hoạt động" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Không thể ngừng hoạt động điểm bán cuối cùng đang hoạt động -- sẽ không còn điểm bán nào để mở máy POS",
        ),
      ).toBeInTheDocument();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});
