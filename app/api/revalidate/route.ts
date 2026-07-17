import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  revalidateTag('sheets-Order_Lines');
  revalidateTag('sheets-Orders');
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
