// Dev-only API route backing the point-and-comment tool.
// sections 6, 7.
//
// Second of the plan's two independent production guards -- refuses
// outside development regardless of whether the client bundle somehow
// shipped (section 6's own reasoning: one guard is a single point of
// failure). The browser cannot write files itself, so this route is the
// only path UI-FEEDBACK.md is ever written through.
import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";
import { appendEntry, emptyFeedbackFile, parseFeedback, removeEntry, type FeedbackEntry } from "@/lib/ui-feedback-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FEEDBACK_PATH = join(process.cwd(), "UI-FEEDBACK.md");

function devOnlyGuard(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  return null;
}

async function readFeedbackFile(): Promise<string> {
  try {
    return await readFile(FEEDBACK_PATH, "utf8");
  } catch {
    return emptyFeedbackFile();
  }
}

export async function GET() {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  const content = await readFeedbackFile();
  return NextResponse.json({ entries: parseFeedback(content) });
}

export async function POST(request: Request) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const input = body as Partial<FeedbackEntry> & { note?: unknown };
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (!note) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const entry: FeedbackEntry = {
    id: crypto.randomBytes(4).toString("hex"),
    createdAt: new Date().toISOString(),
    route: typeof input.route === "string" ? input.route : "",
    viewportWidth: typeof input.viewportWidth === "number" ? input.viewportWidth : 0,
    selector: typeof input.selector === "string" ? input.selector : null,
    className: typeof input.className === "string" ? input.className : null,
    textSnippet: typeof input.textSnippet === "string" ? input.textSnippet : null,
    sourceFile: typeof input.sourceFile === "string" ? input.sourceFile : null,
    sourceLine: typeof input.sourceLine === "number" ? input.sourceLine : null,
    sourceColumn: typeof input.sourceColumn === "number" ? input.sourceColumn : null,
    note,
  };

  const current = await readFeedbackFile();
  await writeFile(FEEDBACK_PATH, appendEntry(current, entry), "utf8");
  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: Request) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const current = await readFeedbackFile();
  await writeFile(FEEDBACK_PATH, removeEntry(current, id), "utf8");
  return new NextResponse(null, { status: 204 });
}
