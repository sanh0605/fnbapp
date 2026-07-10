import * as dotenv from "dotenv";
import {
  recomputeEventApply,
  recomputeEventDryRun,
} from "../lib/backdated-ledger/recompute-event";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main(): Promise<void> {
  const eventId = getArgValue("--event-id");
  const reviewer = getArgValue("--reviewer") || "";
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  if (!eventId) {
    throw new Error("--event-id is required");
  }
  if (apply && !reviewer.trim()) {
    throw new Error("--reviewer is required with --apply");
  }

  if (dryRun) {
    const plan = await recomputeEventDryRun(eventId);
    console.log(JSON.stringify({ mode: "DRY-RUN", ...plan }, null, 2));
    console.log("No database rows were written.");
    return;
  }

  const result = await recomputeEventApply(eventId, reviewer);
  console.log(JSON.stringify({ mode: "APPLY", ...result }, null, 2));
}

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
