import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function GET() {
  revalidateTag('sheets-Order_Lines');
  revalidateTag('sheets-Orders');
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
