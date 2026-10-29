import { NextResponse } from 'next/server';
import { findAccountForRecover } from '@/lib/auth/find-account';
import { normalizeLoginId } from '@/lib/auth/identity';
import { recoverRateLimited } from '@/lib/auth/recover-rate-limit';
import { createRecoverToken } from '@/lib/auth/recover-token';
import {
  batchMatches,
  phoneLast4Digits,
  phoneLast4Matches,
  recoveryConfigured,
  recoveryQuestionLabel,
} from '@/lib/auth/recovery';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const GENERIC = 'Could not verify those details. Check and try again, or contact the alumni committee.';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const loginId = normalizeLoginId(String(body.username || body.email || ''));
    const phoneLast4 = String(body.phoneLast4 || body.phone_last4 || '').trim();
    const batch = body.batch;

    if (!loginId || !phoneLast4) {
      return NextResponse.json({ error: 'Username/email and last 4 phone digits are required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = `challenge:${ip}:${loginId}`;
    if (recoverRateLimited(rateKey)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    const admin = createAdminClient();
    const account = await findAccountForRecover(admin, loginId);
    if (!account) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    if (!phoneLast4Digits(account.phone_number)) {
      return NextResponse.json(
        {
          error:
            'No phone on file for this account. Contact the alumni committee for a temporary password.',
        },
        { status: 400 }
      );
    }

    if (!phoneLast4Matches(phoneLast4, account.phone_number)) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    if (!batchMatches(account.batch, batch)) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    const needsAnswers = recoveryConfigured(account);
    const token = await createRecoverToken({ accountId: account.id, needsAnswers });

    const questions = needsAnswers
      ? [
          { id: account.recovery_q1!, label: recoveryQuestionLabel(account.recovery_q1!) || account.recovery_q1! },
          { id: account.recovery_q2!, label: recoveryQuestionLabel(account.recovery_q2!) || account.recovery_q2! },
        ]
      : [];

    return NextResponse.json({
      ok: true,
      token,
      needsAnswers,
      needsBatch: account.batch != null,
      questions,
    });
  } catch (err) {
    console.error('recover challenge', err);
    return NextResponse.json({ error: 'Could not start recovery' }, { status: 500 });
  }
}
