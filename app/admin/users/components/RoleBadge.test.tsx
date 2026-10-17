// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { RoleBadge } from "./RoleBadge";

afterEach(cleanup);

describe("RoleBadge", () => {
  it("renders Quản lý for MANAGER", () => {
    render(<RoleBadge role="MANAGER" />);
    expect(screen.getByText("Quản lý")).toBeInTheDocument();
  });

  it("renders Quản trị viên for ADMIN", () => {
    render(<RoleBadge role="ADMIN" />);
    expect(screen.getByText("Quản trị viên")).toBeInTheDocument();
  });

  it("renders raw value for unknown role", () => {
    render(<RoleBadge role="XYZ" />);
    expect(screen.getByText("XYZ")).toBeInTheDocument();
  });
});
