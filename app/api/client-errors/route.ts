import { NextResponse } from "next/server";
import { resolveActor } from "@/lib/auth";
import { normalizeClientErrorPayload } from "@/lib/client-error-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await resolveActor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payload = normalizeClientErrorPayload(input);
  if (!payload) {
    return NextResponse.json({ error: "Invalid client error payload" }, { status: 400 });
  }

  console.error("[ClientError]", JSON.stringify({
    ...payload,
    actor: auth.actor,
    receivedAt: new Date().toISOString(),
  }));

  return new NextResponse(null, { status: 204 });
}
