import { describe, expect, it } from "vitest";
import { buildStaffNameResolver } from "./staff-names";

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
