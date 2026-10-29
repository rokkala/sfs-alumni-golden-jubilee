import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { hashPassword } from '@/lib/auth/password';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Admin sets a new password (no email). Share the temp password with the member offline. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const me = await requireVerifiedAdmin();
    if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = String(params.id || '');
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    let password = String(body.password || '').trim();
    if (!password) {
      password = randomTempPassword();
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const password_hash = await hashPassword(password);
    const { data, error } = await admin
      .from('alumni_accounts')
      .update({ password_hash })
      .eq('id', id)
      .select('id,email,full_name')
      .maybeSingle();

    if (error) {
      console.error('admin set password', error);
      return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      temporaryPassword: password,
      member: { id: data.id, email: data.email, full_name: data.full_name },
    });
  } catch (err) {
    console.error('admin set password', err);
    return NextResponse.json({ error: 'Admin API not configured' }, { status: 500 });
  }
}

function randomTempPassword(): string {
  const chunk = Math.random().toString(36).slice(2, 10);
  return `Sfs${chunk}!`;
}
