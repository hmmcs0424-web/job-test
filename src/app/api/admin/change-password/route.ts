import { NextRequest, NextResponse } from 'next/server';

// In production, consider storing in Firestore or environment variable manager
// For simplicity, this updates the runtime env. Vercel env must be updated manually.
export async function POST(req: NextRequest) {
  const { newPassword } = await req.json();
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 400 });
  }
  // Vercel env vars cannot be updated at runtime.
  // Store the override in Firestore admin config instead.
  const { setAdminConfig } = await import('@/lib/firestore');
  await setAdminConfig({ passwordOverride: newPassword });
  return NextResponse.json({ ok: true });
}
