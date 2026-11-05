import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import {
  assertDonationAmountPaise,
  assertDonationMessage,
} from '@/lib/donations/validate';
import {
  PAYMENT_PROOFS_BUCKET,
  paymentProofObjectPath,
} from '@/lib/payments/proof-storage';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extForMime(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.role === 'admin') {
    return NextResponse.json({ error: 'Committee accounts do not pay here' }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 });
  }

  const sourceType = String(form.get('sourceType') || '').trim();
  const utr = String(form.get('utr') || '').trim() || null;
  const paymentAccountIdRaw = String(form.get('paymentAccountId') || '').trim();
  const paymentAccountId = UUID_RE.test(paymentAccountIdRaw) ? paymentAccountIdRaw : null;
  const file = form.get('screenshot');
  const blob = file instanceof File && file.size > 0 ? file : null;

  if (!utr && !blob) {
    return NextResponse.json(
      { error: 'Add a UTR reference or a payment screenshot' },
      { status: 400 }
    );
  }

  if (blob) {
    if (!ALLOWED_MIME.has(blob.type)) {
      return NextResponse.json({ error: 'Screenshot must be JPEG, PNG, or WebP' }, { status: 400 });
    }
    if (blob.size > 4_000_000) {
      return NextResponse.json({ error: 'Screenshot must be under 4 MB' }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  const { data: payAccount } = paymentAccountId
    ? await admin
        .from('payment_accounts')
        .select('id')
        .eq('id', paymentAccountId)
        .eq('active', true)
        .maybeSingle()
    : await admin
        .from('payment_accounts')
        .select('id')
        .eq('active', true)
        .maybeSingle();

  if (!payAccount) {
    return NextResponse.json({ error: 'No active bank / UPI account' }, { status: 400 });
  }

  let registrationId: string | null = null;
  let donationId: string | null = null;
  let amountPaise: number;

  if (sourceType === 'registration') {
    registrationId = String(form.get('registrationId') || '').trim();
    if (!UUID_RE.test(registrationId)) {
      return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
    }
    const { data: reg, error: regErr } = await admin
      .from('event_registrations')
      .select('id,account_id,total_cost_paise,amount_paid_paise,payment_status')
      .eq('id', registrationId)
      .maybeSingle();
    if (regErr || !reg || reg.account_id !== me.id) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }
    const total = Math.max(0, Number(reg.total_cost_paise) || 0);
    const paid = Math.max(0, Number(reg.amount_paid_paise) || 0);
    amountPaise = Math.max(0, total - paid);
    if (amountPaise < 100) {
      return NextResponse.json({ error: 'Nothing due on this registration' }, { status: 400 });
    }
  } else if (sourceType === 'donation') {
    if (me.member_status !== 'verified') {
      return NextResponse.json({ error: 'Membership must be verified to donate' }, { status: 403 });
    }
    const causeId = String(form.get('causeId') || '').trim();
    if (!UUID_RE.test(causeId)) {
      return NextResponse.json({ error: 'causeId is required' }, { status: 400 });
    }
    let message: string | null;
    try {
      amountPaise = assertDonationAmountPaise(form.get('amountPaise'));
      message = assertDonationMessage(form.get('message'));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid donation' },
        { status: 400 }
      );
    }
    const { data: cause, error: causeErr } = await admin
      .from('donation_causes')
      .select('id,active')
      .eq('id', causeId)
      .maybeSingle();
    if (causeErr || !cause?.active) {
      return NextResponse.json({ error: 'Cause not found or inactive' }, { status: 400 });
    }
    const { data: donation, error: donErr } = await admin
      .from('donations')
      .insert({
        account_id: me.id,
        cause_id: cause.id,
        amount_paise: amountPaise,
        message,
        payment_status: 'pending',
      })
      .select('id')
      .single();
    if (donErr || !donation) {
      console.error('offline donation insert', donErr);
      return NextResponse.json({ error: 'Could not start donation' }, { status: 500 });
    }
    donationId = donation.id;
  } else {
    return NextResponse.json(
      { error: 'sourceType must be registration or donation' },
      { status: 400 }
    );
  }

  let screenshot_path: string | null = null;
  if (blob) {
    const objectId = randomUUID();
    screenshot_path = paymentProofObjectPath(me.id, objectId, extForMime(blob.type));
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .upload(screenshot_path, buffer, { contentType: blob.type, upsert: false });
    if (uploadError) {
      console.error('offline proof upload', uploadError);
      if (donationId) {
        await admin.from('donations').delete().eq('id', donationId);
      }
      return NextResponse.json({ error: 'Could not upload screenshot' }, { status: 500 });
    }
  }

  const { data: proof, error: proofErr } = await admin
    .from('offline_payment_proofs')
    .insert({
      source_type: sourceType,
      registration_id: registrationId,
      donation_id: donationId,
      account_id: me.id,
      payment_account_id: payAccount.id,
      amount_paise: amountPaise,
      utr,
      screenshot_path,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .select('id,status,amount_paise,donation_id,registration_id')
    .single();

  if (proofErr || !proof) {
    console.error('offline proof insert', proofErr);
    if (screenshot_path) {
      await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove([screenshot_path]).catch(() => undefined);
    }
    if (donationId) {
      await admin.from('donations').delete().eq('id', donationId);
    }
    return NextResponse.json({ error: 'Could not submit proof' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    proof,
    message: 'Submitted for committee verification. You will be confirmed once reviewed.',
  });
}
