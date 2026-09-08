import { describe, expect, it } from "vitest";
import { creationAudit, updateAudit } from "./audit-columns";

const actor = { id: "USR-001", name: "Sanh", role: "ADMIN" as const };

describe("audit columns", () => {
  it("stamps both id and name on creation, and seeds the update pair too", () => {
    expect(creationAudit(actor)).toEqual({
      created_by_id: "USR-001",
      created_by_name: "Sanh",
      updated_by_id: "USR-001",
      updated_by_name: "Sanh",
    });
  });

  it("stamps only the update pair on an edit, so the creator is never overwritten", () => {
    const cols = updateAudit(actor);
    expect(cols).toEqual({ updated_by_id: "USR-001", updated_by_name: "Sanh" });
    expect(cols).not.toHaveProperty("created_by_id");
  });

  it("never writes timestamps -- the database owns those", () => {
    const all = { ...creationAudit(actor), ...updateAudit(actor) };
    expect(all).not.toHaveProperty("created_at");
    expect(all).not.toHaveProperty("updated_at");
  });
});
