// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { OutletForm } from "./OutletForm";
import type { DBOutlet, DBBrand } from "@/types/db";

const { replace, refresh, back, push, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    searchParams: new URLSearchParams(),
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

const mocks = vi.hoisted(() => ({
  addOutlet: vi.fn(),
  editOutlet: vi.fn(),
  retireOutlet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/outlets",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("@/app/admin/outlets/actions", () => ({
  addOutlet: mocks.addOutlet,
  editOutlet: mocks.editOutlet,
  retireOutlet: mocks.retireOutlet,
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (typeof window !== "undefined" && !HTMLFormElement.prototype.requestSubmit) {
  HTMLFormElement.prototype.requestSubmit = function () {
    this.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
}

const BRANDS: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", start_date: "", status: "ACTIVE", created_at: "" },
];

const OUTLET: DBOutlet = {
  id: "OUT-001", code: "001", name: "Điểm bán 1", brand_id: "BR-001", address: "123 ABC",
  status: "ACTIVE", start_date: "2026-01-01", end_date: null,
  open_time: "06:00", close_time: "21:00", created_at: "", updated_at: "",
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
  mocks.addOutlet.mockReset();
  mocks.editOutlet.mockReset();
  mocks.retireOutlet.mockReset();
});

describe("OutletForm edit mode", () => {
  it("shows brand, address, start date and both hour fields, not the name alone", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector('select[name="brand_id"]')).not.toBeNull();
    expect(document.querySelector('input[name="address"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Ngày bắt đầu hoạt động");
    expect(document.querySelector('[name="open_time"]')).not.toBeNull();
    expect(document.querySelector('[name="close_time"]')).not.toBeNull();
  });

  it("pre-fills brand, address and hours from the outlet being edited", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);

    const brandSelect = document.querySelector('select[name="brand_id"]') as HTMLSelectElement;
    const addressInput = document.querySelector('input[name="address"]') as HTMLInputElement;
    const openInput = document.querySelector('[name="open_time"]') as HTMLSelectElement;
    const closeInput = document.querySelector('[name="close_time"]') as HTMLSelectElement;

    expect(brandSelect.value).toBe("BR-001");
    expect(addressInput.value).toBe("123 ABC");
    expect(openInput.value).toBe("06:00");
    expect(closeInput.value).toBe("21:00");
  });

  it("shows the code, frozen and explained, not editable", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);

    expect(document.body.textContent).toContain("001");
    expect(document.body.textContent).toContain("không đổi được");
    expect(document.querySelector('input[name="code"]')).toBeNull();
  });

  it("shows FormActionBar with Lưu thay đổi and Bỏ thay đổi buttons in edit mode", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets" />);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });

  it("clicking Bỏ thay đổi in edit mode goes to returnTo without saving", () => {
    render(<OutletForm initialData={OUTLET} brands={BRANDS} outlets={[OUTLET]} returnTo="/admin/outlets?tab=all" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenCalledWith("/admin/outlets?tab=all");
    expect(mocks.editOutlet).not.toHaveBeenCalled();
  });
});

describe("OutletForm sections", () => {
  it("renders section headings Thông tin and Giờ hoạt động in order", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    const infoHeading = screen.getByText("Thông tin");
    const hoursHeading = screen.getByText("Giờ hoạt động");
    expect(infoHeading).toBeInTheDocument();
    expect(hoursHeading).toBeInTheDocument();
    expect(infoHeading.compareDocumentPosition(hoursHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// Wave K6: the two hour boxes use Select with half-hour options;
// Postgres "HH:MM:SS" shows as HH:MM and is posted as HH:MM.
describe("OutletForm hour boxes (wave K6)", () => {
  it("07:00:00 and 22:30:00 show as 07:00 and 22:30 and are sent as open_time=07:00, close_time=22:30", async () => {
    mocks.editOutlet.mockResolvedValue({});
    render(
      <OutletForm
        initialData={{ ...OUTLET, open_time: "07:00:00", close_time: "22:30:00" }}
        brands={BRANDS}
        outlets={[OUTLET]}
        returnTo="/admin/outlets"
      />,
    );
    const open = screen.getByLabelText(/^Giờ mở cửa/) as HTMLSelectElement;
    const close = screen.getByLabelText(/^Giờ đóng cửa/) as HTMLSelectElement;
    expect(open.tagName).toBe("SELECT");
    expect(close.tagName).toBe("SELECT");
    expect(open.value).toBe("07:00");
    expect(close.value).toBe("22:30");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.editOutlet).toHaveBeenCalledTimes(1));
    const formData = mocks.editOutlet.mock.calls[0][0] as FormData;
    expect(formData.get("open_time")).toBe("07:00");
    expect(formData.get("close_time")).toBe("22:30");
  });

  it("blank hours are sent blank", async () => {
    mocks.editOutlet.mockResolvedValue({});
    render(
      <OutletForm
        initialData={{ ...OUTLET, open_time: null, close_time: null } as unknown as DBOutlet}
        brands={BRANDS}
        outlets={[OUTLET]}
        returnTo="/admin/outlets"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.editOutlet).toHaveBeenCalledTimes(1));
    const formData = mocks.editOutlet.mock.calls[0][0] as FormData;
    expect(formData.get("open_time")).toBe("");
    expect(formData.get("close_time")).toBe("");
  });

  it('a saved open time "07:15:00" shows "07:15" selected as an extra option, "Chưa đặt" is the first option, and submitting posts open_time = "07:15"', async () => {
    mocks.editOutlet.mockResolvedValue({});
    render(
      <OutletForm
        initialData={{ ...OUTLET, open_time: "07:15:00" }}
        brands={BRANDS}
        outlets={[OUTLET]}
        returnTo="/admin/outlets"
      />,
    );
    const open = screen.getByLabelText(/^Giờ mở cửa/) as HTMLSelectElement;
    expect(open.value).toBe("07:15");
    expect(open.options[0].textContent).toBe("Chưa đặt");
    expect(open.options[0].value).toBe("");
    const optionValues = Array.from(open.options).map((opt) => opt.value);
    expect(optionValues).toContain("07:15");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.editOutlet).toHaveBeenCalledTimes(1));
    const formData = mocks.editOutlet.mock.calls[0][0] as FormData;
    expect(formData.get("open_time")).toBe("07:15");
  });

  it("shows DayInput error and does not call save action on invalid day", async () => {
    const { container } = render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    const dayBox = screen.getByLabelText(/^Ngày bắt đầu hoạt động/) as HTMLInputElement;
    fireEvent.change(dayBox, { target: { value: "32/13/2026" } });
    fireEvent.blur(dayBox);
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Ngày không hợp lệ")).toBeInTheDocument();
    expect(mocks.addOutlet).not.toHaveBeenCalled();
    expect(mocks.editOutlet).not.toHaveBeenCalled();
  });
});

describe("OutletForm add mode", () => {
  it("shows FormActionBar with Tạo and Bỏ buttons in add mode", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("also shows brand, address, start date and both hour fields", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);

    expect(document.querySelector('select[name="brand_id"]')).not.toBeNull();
    expect(document.querySelector('input[name="address"]')).not.toBeNull();
    expect(document.querySelector('[name="open_time"]')).not.toBeNull();
    expect(document.querySelector('[name="close_time"]')).not.toBeNull();
  });

  it("shows the next auto-assigned code previewing nextOutletCode (004 for 001 and 003)", () => {
    const existingOutlets: DBOutlet[] = [
      { ...OUTLET, id: "OUT-001", code: "001" },
      { ...OUTLET, id: "OUT-003", code: "003" },
    ];
    render(<OutletForm brands={BRANDS} outlets={existingOutlets} returnTo="/admin/outlets" />);

    expect(document.body.textContent).toContain("004");
    expect(document.body.textContent).toContain("Mã điểm bán sẽ được gán tự động");
  });

  it("clicking Bỏ goes to returnTo without saving", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/outlets");
    expect(mocks.addOutlet).not.toHaveBeenCalled();
  });

  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z and preserves start_date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      mocks.editOutlet.mockResolvedValue({});
      const { unmount } = render(
        <OutletForm
          initialData={{ ...OUTLET, start_date: "2026-09-15" }}
          brands={BRANDS}
          outlets={[OUTLET]}
          returnTo="/admin/outlets"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
      await waitFor(() => expect(mocks.editOutlet).toHaveBeenCalledTimes(1));
      const formData = mocks.editOutlet.mock.calls[0][0] as FormData;
      expect(formData.get("start_date")).toBe("2026-09-15");
      unmount();

      // Second assertion path: ADD mode without passing start_date in
      mocks.addOutlet.mockResolvedValue({});
      render(
        <OutletForm
          brands={BRANDS}
          outlets={[]}
          returnTo="/admin/outlets"
        />
      );

      fireEvent.change(document.querySelector('input[name="name"]')!, {
        target: { value: "Điểm bán 2" },
      });
      fireEvent.change(document.querySelector('select[name="brand_id"]')!, {
        target: { value: "BR-001" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
      await waitFor(() => expect(mocks.addOutlet).toHaveBeenCalledTimes(1));
      const addFormData = mocks.addOutlet.mock.calls[0][0] as FormData;
      // The outlet form has no default day: start_date is not set (null)
      expect(addFormData.get("start_date")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// Owner 2026-10-11 trial (BR-UI-012): a form with few boxes uses the whole
// 1,280 px page frame and lays its boxes in two columns on a computer, rather
// than a 672 px box on the left; a phone keeps one column.
describe("OutletForm in two columns on a computer (owner 2026-10-11 trial)", () => {
  it("the card keeps no width of its own", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    const form = document.querySelector("form") as HTMLElement;
    let el: HTMLElement | null = form;
    while (el && el !== document.body) {
      expect(el.className).not.toMatch(/\bmax-w-/);
      el = el.parentElement;
    }
  });

  it("name, brand, address and start date sit in one two-column grid", () => {
    render(<OutletForm brands={BRANDS} outlets={[]} returnTo="/admin/outlets" />);
    const grid = screen.getByTestId("form-fields");
    expect(grid.className).toMatch(/\bgrid-cols-1\b/);
    expect(grid.className).toMatch(/\bmd:grid-cols-2\b/);
    for (const name of ["name", "brand_id", "address", "open_time", "close_time"]) {
      expect(grid.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
  });
});
