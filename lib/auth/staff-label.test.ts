import { describe, expect, it } from "vitest";
import { staffLabel, staffPickerLabels } from "./staff-label";

describe("staffLabel", () => {
  it("shows the trimmed name and flags that the login is worth showing beside it", () => {
    expect(staffLabel({ name: "  Tài Chí Tuyền ", username: "tuyen2612" })).toEqual({ name: "Tài Chí Tuyền", showLogin: true });
  });

  it("falls back to the login, with nothing extra to show, for a blank or missing name", () => {
    expect(staffLabel({ name: "  ", username: "admin" })).toEqual({ name: "admin", showLogin: false });
    expect(staffLabel({ username: "lan" })).toEqual({ name: "lan", showLogin: false });
    expect(staffLabel({ name: "lan", username: "lan" }).showLogin).toBe(false);
  });
});

describe("staffPickerLabels", () => {
  it("labels each login with its name, and adds the login only where two people share a name", () => {
    const labels = staffPickerLabels([
      { username: "admin", name: "Admin" },
      { username: "admin2", name: " Admin " },
      { username: "tuyen2612", name: "Tài Chí Tuyền" },
      { username: "lan", name: null },
    ]);
    expect(Object.fromEntries(labels)).toEqual({
      admin: "Admin (admin)", admin2: "Admin (admin2)", tuyen2612: "Tài Chí Tuyền", lan: "lan",
    });
  });
});
