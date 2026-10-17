// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
  it("has whitespace-nowrap class so pills never break inside", () => {
    render(<Badge>Trạng thái</Badge>);
    const badge = screen.getByText("Trạng thái");
    expect(badge.className).toContain("whitespace-nowrap");
  });
});
