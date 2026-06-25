import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy inventory sync is disabled. Use V2 order ledger audit/correction scripts instead.",
    },
    { status: 410 },
  );
}
