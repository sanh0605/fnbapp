import { describe, expect, it } from "vitest";
import { buildStaffNameResolver, staffLabel, staffPickerLabels } from "./staff-names";

const users = [
  { id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" },
  { id: "USR-001", username: "admin", name: "  " },
  { id: "USR-003", username: "lan", name: null },
];
const resolve = buildStaffNameResolver(users);

describe("buildStaffNameResolver", () => {
  it("maps a stored login to the staff name", () => {
    expect(resolve("tuyen2612")).toBe("Tài Chí Tuyền");
  });

  it("looks up by id first, even when the stored text is stale", () => {
    expect(resolve("old-login", "USR-002")).toBe("Tài Chí Tuyền");
  });

  it("falls back to the login when the id is unknown", () => {
    expect(resolve("tuyen2612", "USR-999")).toBe("Tài Chí Tuyền");
  });

  it("keeps the stored text for an unknown person, a blank name, or a missing name", () => {
    expect(resolve("ghost", "USR-404")).toBe("ghost");
    expect(resolve("admin", "USR-001")).toBe("admin");
    expect(resolve("lan")).toBe("lan");
  });

  it("returns null for nothing stored and nobody found", () => {
    expect(resolve(null)).toBeNull();
    expect(resolve(undefined)).toBeNull();
  });
});

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
      { id: "u1", username: "admin", name: "Admin" },
      { id: "u2", username: "admin2", name: " Admin " },
      { id: "u3", username: "tuyen2612", name: "Tài Chí Tuyền" },
      { id: "u4", username: "lan", name: null },
    ]);
    expect(Object.fromEntries(labels)).toEqual({
      admin: "Admin (admin)", admin2: "Admin (admin2)", tuyen2612: "Tài Chí Tuyền", lan: "lan",
    });
  });
});
