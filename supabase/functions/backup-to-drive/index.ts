import {
  buildDatabaseSnapshot,
  type SnapshotEnvironment,
} from "./core.ts";
import { handleSnapshotRequest } from "./handler.ts";

function readDatabaseEnvironment(): SnapshotEnvironment {
  return {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SECRET_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      || "",
  };
}

Deno.serve(async (request: Request) => {
  const startedAt = new Date().toISOString();
  return await handleSnapshotRequest(
    request,
    { pullToken: Deno.env.get("BACKUP_PULL_TOKEN") || "" },
    () => buildDatabaseSnapshot(readDatabaseEnvironment(), { capturedAt: startedAt }),
  );
});
