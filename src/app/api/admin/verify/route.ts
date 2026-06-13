import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const defaultPassword = process.env.ADMIN_PASSWORD ?? 'hmm0424!';

  // Check Firestore override first
  try {
    const { getAdminConfig } = await import('@/lib/firestore');
    const config = await getAdminConfig();
    const activePassword = (config as Record<string, string> | null)?.passwordOverride ?? defaultPassword;
    if (password === activePassword) {
      return NextResponse.json({ ok: true });
    }
  } catch {
    if (password === defaultPassword) {
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
