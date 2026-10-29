import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/** Logged-in member changes password with current password (no email). */
export async function POST(request: Request) {
  try {
    const me = await getCurrentAccount();
    if (!me) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const current = String(body.currentPassword || body.current || '');
    const next = String(body.password || body.newPassword || '');
    const confirm = String(body.confirm || body.password_confirm || '');

    if (!current || !next) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }
    if (next.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }
    if (next !== confirm) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row, error: findErr } = await admin
      .from('alumni_accounts')
      .select('id,password_hash')
      .eq('id', me.id)
      .single();

    if (findErr || !row) {
      return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
    }

    const ok = await verifyPassword(current, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const password_hash = await hashPassword(next);
    const { error: updErr } = await admin
      .from('alumni_accounts')
      .update({ password_hash })
      .eq('id', me.id);

    if (updErr) {
      console.error('change-password', updErr);
      return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('change-password', err);
    return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
  }
}
