import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { hashPassword } from '@/lib/auth/password';
import {
  RECOVERY_QUESTIONS,
  normalizeRecoveryAnswer,
  recoveryConfigured,
  validateQuestionPick,
} from '@/lib/auth/recovery';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const me = await getCurrentAccount();
    if (!me) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('alumni_accounts')
      .select('recovery_q1,recovery_a1_hash,recovery_q2,recovery_a2_hash')
      .eq('id', me.id)
      .maybeSingle();

    if (error) {
      console.error('recovery-questions get', error);
      return NextResponse.json({ error: 'Could not load recovery questions' }, { status: 500 });
    }

    const row = data || {
      recovery_q1: null,
      recovery_a1_hash: null,
      recovery_q2: null,
      recovery_a2_hash: null,
    };

    return NextResponse.json({
      questions: RECOVERY_QUESTIONS,
      configured: recoveryConfigured(row),
      selected: row.recovery_q1 && row.recovery_q2 ? [row.recovery_q1, row.recovery_q2] : [],
    });
  } catch (err) {
    console.error('recovery-questions get', err);
    return NextResponse.json({ error: 'Could not load recovery questions' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const me = await getCurrentAccount();
    if (!me) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const q1 = String(body.q1 || body.question1 || '');
    const q2 = String(body.q2 || body.question2 || '');
    const a1 = normalizeRecoveryAnswer(String(body.a1 || body.answer1 || ''));
    const a2 = normalizeRecoveryAnswer(String(body.a2 || body.answer2 || ''));

    const pickErr = validateQuestionPick([q1, q2]);
    if (pickErr) return NextResponse.json({ error: pickErr }, { status: 400 });
    if (a1.length < 2 || a2.length < 2) {
      return NextResponse.json({ error: 'Answers must be at least 2 characters' }, { status: 400 });
    }

    const [h1, h2] = await Promise.all([hashPassword(a1), hashPassword(a2)]);
    const admin = createAdminClient();
    const { error } = await admin
      .from('alumni_accounts')
      .update({
        recovery_q1: q1,
        recovery_a1_hash: h1,
        recovery_q2: q2,
        recovery_a2_hash: h2,
      })
      .eq('id', me.id);

    if (error) {
      console.error('recovery-questions put', error);
      return NextResponse.json(
        { error: 'Could not save. Run the recovery questions migration if this is new.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, configured: true });
  } catch (err) {
    console.error('recovery-questions put', err);
    return NextResponse.json({ error: 'Could not save recovery questions' }, { status: 500 });
  }
}
