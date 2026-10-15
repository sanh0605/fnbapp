import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findAll: vi.fn() }));
vi.mock("@/lib/db/tables", () => ({ findAll: mocks.findAll }));
vi.mock("./components/LoginForm", () => ({ default: () => null }));

import LoginPage from "./page";

const brands = (rows: Array<[string, string]>) =>
  mocks.findAll.mockResolvedValue(rows.map(([name, status]) => ({ name, status })));

describe("LoginPage title", () => {
  beforeEach(() => vi.clearAllMocks());

  it("joins the ACTIVE brand names and skips stopped ones", async () => {
    brands([["Phin Đi", "ACTIVE"], ["Uchako", "ACTIVE"], ["Cũ", "INACTIVE"]]);
    const element: any = await LoginPage();
    expect(element.props.title).toBe("Phin Đi · Uchako");
  });

  it("falls back to Đăng nhập when no brand is active", async () => {
    brands([["Cũ", "INACTIVE"]]);
    const element: any = await LoginPage();
    expect(element.props.title).toBe("Đăng nhập");
  });

  it("still renders with Đăng nhập when the brand read fails", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));
    const element: any = await LoginPage();
    expect(element.props.title).toBe("Đăng nhập");
  });
});
