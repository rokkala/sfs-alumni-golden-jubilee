import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import {
  assertDonationAmountPaise,
  assertDonationMessage,
} from '@/lib/donations/validate';
import {
  getRazorpayClient,
  isRazorpayConfigured,
  razorpayKeyId,
  razorpayKeysAligned,
} from '@/lib/payments/razorpay';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.role === 'admin') {
    return NextResponse.json({ error: 'Committee accounts do not pay here' }, { status: 400 });
  }
  if (me.member_status !== 'verified') {
    return NextResponse.json({ error: 'Membership must be verified to donate' }, { status: 403 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      {
        error: 'Payments are not configured yet. Please try again later.',
        configured: false,
      },
      { status: 503 }
    );
  }

  if (!razorpayKeysAligned()) {
    return NextResponse.json(
      {
        error:
          'Payment keys mismatch: NEXT_PUBLIC_RAZORPAY_KEY_ID must equal RAZORPAY_KEY_ID (same test or live key).',
        configured: false,
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const causeId = String(body.causeId || '').trim();
  if (!causeId) {
    return NextResponse.json({ error: 'causeId is required' }, { status: 400 });
  }

  let amountPaise: number;
  let message: string | null;
  try {
    amountPaise = assertDonationAmountPaise(body.amountPaise);
    message = assertDonationMessage(body.message);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid donation' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: cause, error: causeErr } = await admin
    .from('donation_causes')
    .select('id,title,active')
    .eq('id', causeId)
    .maybeSingle();

  if (causeErr || !cause || !cause.active) {
    return NextResponse.json({ error: 'Cause not found or inactive' }, { status: 400 });
  }

  const { data: donation, error: insErr } = await admin
    .from('donations')
    .insert({
      account_id: me.id,
      cause_id: cause.id,
      amount_paise: amountPaise,
      message,
      payment_status: 'pending',
    })
    .select('id,amount_paise')
    .single();

  if (insErr || !donation) {
    console.error('donation insert', insErr);
    return NextResponse.json({ error: 'Could not start donation' }, { status: 500 });
  }

  const client = getRazorpayClient();
  if (!client) {
    return NextResponse.json({ error: 'Payments are not configured', configured: false }, { status: 503 });
  }

  try {
    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `don_${donation.id.slice(0, 8)}_${Date.now()}`.slice(0, 40),
      notes: {
        donation_id: donation.id,
        cause_id: cause.id,
        account_id: me.id,
      },
    });

    const { error: updError } = await admin
      .from('donations')
      .update({
        razorpay_order_id: order.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', donation.id);

    if (updError) {
      console.error('donation order persist', updError);
      return NextResponse.json({ error: 'Could not save payment order' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      donationId: donation.id,
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: razorpayKeyId(),
      name: me.full_name,
      email: me.email,
      contact: me.phone_number,
      description: `Donation · ${cause.title}`,
    });
  } catch (err) {
    console.error('donation razorpay order', err);
    await admin
      .from('donations')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', donation.id);
    return NextResponse.json({ error: 'Could not create payment order' }, { status: 502 });
  }
}
