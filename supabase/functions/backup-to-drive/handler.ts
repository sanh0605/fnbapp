// @ts-ignore Deno requires explicit local TypeScript extensions.
import { validateBackupBundle, type BackupBundle } from "./core.ts";

type HandlerEnvironment = { pullToken: string };
type SnapshotBuilder = () => Promise<BackupBundle>;

export async function handleSnapshotRequest(
  request: Request,
  env: HandlerEnvironment,
  buildSnapshot: SnapshotBuilder,
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const received = request.headers.get("X-Backup-Token") || "";
  if (!validToken(env.pullToken, received)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bundle = await buildSnapshot();
    const summary = validateBackupBundle(bundle);
    return Response.json(bundle, {
      headers: {
        "Cache-Control": "no-store",
        "X-Backup-Schema-Version": String(bundle.schemaVersion),
        "X-Backup-Table-Count": String(summary.tableCount),
        "X-Backup-Row-Count": String(summary.totalRowCount),
      },
    });
  } catch (error) {
    console.error("[backup-to-drive] snapshot failed", error);
    return Response.json({
      error: "Snapshot failed",
      message: error instanceof Error ? error.message : String(error),
      backupAt: new Date().toISOString(),
    }, { status: 500 });
  }
}

function validToken(expected: string, received: string): boolean {
  if (expected.length < 32 || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }
  return difference === 0;
}
