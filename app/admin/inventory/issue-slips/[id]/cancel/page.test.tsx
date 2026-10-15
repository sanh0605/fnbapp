import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn());
const getIssueSlipDetail = vi.hoisted(() => vi.fn());

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/components/ui/BackLink", () => ({
  BackLink: ({ href, label }: any) => ({ type: "a", props: { href, children: label } }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => ({
    type: "a",
    props: { href, children },
  }),
}));
vi.mock("../../actions", () => ({
  getIssueSlipDetail,
}));
vi.mock("./components/CancelIssueSlipForm", () => ({
  default: ({ detail }: any) => ({
    props: {
      children: detail.cancellation || detail.lock ? "Phiếu này không huỷ được" : "MOCK_CANCEL_FORM",
    },
  }),
}));

import CancelIssueSlipPage from "./page";

function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return out;
  }
  const el = node as { type?: any; props?: { children?: ReactNode } };
  if (typeof el?.type === "function") {
    try {
      collectText(el.type(el.props), out);
    } catch {}
  } else if (el?.props) {
    collectText(el.props.children, out);
  }
  return out;
}

describe("CancelIssueSlipPage", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockReset();
    notFound.mockReset();
    getIssueSlipDetail.mockReset();
  });

  it("STAFF is redirected to the detail page", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "STAFF" } });
    redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(CancelIssueSlipPage({ params: Promise.resolve({ id: "ISL-00076" }) })).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(redirect).toHaveBeenCalledWith("/admin/inventory/issue-slips/ISL-00076");
    expect(getIssueSlipDetail).not.toHaveBeenCalled();
  });

  it("calls notFound if slip does not exist", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    getIssueSlipDetail.mockResolvedValueOnce(null);
    notFound.mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(CancelIssueSlipPage({ params: Promise.resolve({ id: "ISL-99999" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("ready view renders CancelIssueSlipForm and header", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    getIssueSlipDetail.mockResolvedValueOnce({
      id: "ISL-00076",
      dateText: "28/09/2026 18:20",
      createdByName: "tuyen2612",
      lines: [],
      totalValue: 0,
      cancellation: null,
      lock: null,
      canEdit: true,
    });

    const tree = await CancelIssueSlipPage({ params: Promise.resolve({ id: "ISL-00076" }) });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Huỷ phiếu ISL-00076");
    expect(text).toContain("Ngày xuất: 28/09/2026 18:20 · Người ghi: tuyen2612");
    expect(text).toContain("Phiếu xuất");
    expect(text).toContain("MOCK_CANCEL_FORM");
  });

  it("cancelled slip shows Phiếu này không huỷ được", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    getIssueSlipDetail.mockResolvedValueOnce({
      id: "ISL-00076",
      dateText: "28/09/2026 18:20",
      createdByName: "tuyen2612",
      lines: [],
      totalValue: 0,
      cancellation: { at: "2026-09-29T10:00:00Z", dateText: "29/09/2026 17:00", reason: "Ghi nhầm" },
      lock: null,
      canEdit: false,
    });

    const tree = await CancelIssueSlipPage({ params: Promise.resolve({ id: "ISL-00076" }) });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Huỷ phiếu ISL-00076");
    expect(text).toContain("Phiếu này không huỷ được");
  });
});
