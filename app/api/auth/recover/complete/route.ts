import { NextResponse } from 'next/server';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { recoverRateLimited } from '@/lib/auth/recover-rate-limit';
import { verifyRecoverToken } from '@/lib/auth/recover-token';
import { normalizeRecoveryAnswer, recoveryConfigured } from '@/lib/auth/recovery';
import { passwordsMatch } from '@/lib/auth/identity';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const GENERIC = 'Could not verify those details. Check and try again, or contact the alumni committee.';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const password = String(body.password || '');
    const confirm = String(body.confirm || body.password_confirm || '');
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

    if (!token) {
      return NextResponse.json({ error: 'Recovery session missing. Start again.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (!passwordsMatch(password, confirm)) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (recoverRateLimited(`complete:${ip}:${token.slice(0, 12)}`)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    const payload = await verifyRecoverToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Recovery session expired. Start again.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: row, error: findErr } = await admin
      .from('alumni_accounts')
      .select('id,recovery_q1,recovery_a1_hash,recovery_q2,recovery_a2_hash')
      .eq('id', payload.accountId)
      .maybeSingle();

    if (findErr || !row) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    if (payload.needsAnswers || recoveryConfigured(row)) {
      const a1 = normalizeRecoveryAnswer(String(answers[row.recovery_q1!] || answers.a1 || ''));
      const a2 = normalizeRecoveryAnswer(String(answers[row.recovery_q2!] || answers.a2 || ''));
      if (!a1 || !a2 || !row.recovery_a1_hash || !row.recovery_a2_hash) {
        return NextResponse.json({ error: GENERIC }, { status: 401 });
      }
      const [ok1, ok2] = await Promise.all([
        verifyPassword(a1, row.recovery_a1_hash),
        verifyPassword(a2, row.recovery_a2_hash),
      ]);
      if (!ok1 || !ok2) {
        return NextResponse.json({ error: GENERIC }, { status: 401 });
      }
    }

    const password_hash = await hashPassword(password);
    const { error: updErr } = await admin
      .from('alumni_accounts')
      .update({ password_hash })
      .eq('id', payload.accountId);

    if (updErr) {
      console.error('recover complete', updErr);
      return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('recover complete', err);
    return NextResponse.json({ error: 'Could not reset password' }, { status: 500 });
  }
}
