// Turns a caught exception into what a server action returns, so the
// owner is never shown a raw technical string with no relation to what he
// did wrong.
// section 3.
import type { ActionResponse } from "@/lib/shared-actions";

const GENERIC_MESSAGE =
  "Có lỗi xảy ra, vui lòng thử lại. Nếu vẫn còn lỗi, báo cho người quản lý kỹ thuật kèm theo việc anh vừa làm.";

// Every deliberately-written message in this codebase is Vietnamese --
// CLAUDE.md's own rule for anything the owner reads, followed both by
// validation checks written directly in TypeScript and by the RAISE
// EXCEPTION guards inside this app's "atomic" Postgres RPCs (confirmed
// against real fixtures: create_issue_slip_atomic's I4/I5/I10 refusals,
// reverse_stocktake_session_atomic's U2-U4 refusals -- all Vietnamese,
// all meant to reach the owner verbatim, all already covered by existing
// tests that this file's own test suite pins). Every known raw/technical
// exception (a Supabase auth message, a Postgres schema/constraint error,
// a bare "Unknown error") is plain ASCII English, because none of those
// libraries ever emit Vietnamese. A non-ASCII character is therefore the
// signal that distinguishes "written for the owner" from "not" -- not a
// generic heuristic, a fact about this specific codebase's own convention.
function looksHandWrittenForTheOwner(message: string): boolean {
  return /[^\x00-\x7F]/.test(message);
}

// Logged server-side only for the sites this function actually genericizes
// -- a message already judged fit for the owner explains itself and needs
// no duplicate; the raw ones are exactly what an engineer would otherwise
// have lost.
export function describeActionError(error: unknown): ActionResponse {
  const raw = error instanceof Error ? error.message : String(error);

  if (looksHandWrittenForTheOwner(raw)) {
    return { error: raw };
  }

  console.error("[ActionError]", error);
  return { error: GENERIC_MESSAGE, errorDetail: raw };
}
