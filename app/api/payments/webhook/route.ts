import { NextResponse } from 'next/server';
import { applyDonationPayment } from '@/lib/donations/mark-paid';
import { applyRegistrationPayment } from '@/lib/events/mark-paid';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string; id?: string; amount?: number; status?: string } };
      order?: { entity?: { id?: string; amount?: number; status?: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event || '';
  if (event !== 'payment.captured' && event !== 'order.paid') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = payload.payload?.payment?.entity;
  const orderId = payment?.order_id || payload.payload?.order?.entity?.id;
  const paymentId = payment?.id;
  const amount = Math.max(0, Number(payment?.amount) || 0);

  if (!orderId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from('event_registrations')
    .select('id,total_cost_paise,amount_paid_paise')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();

  if (reg) {
    await applyRegistrationPayment({
      registrationId: reg.id,
      paymentPaise: amount || undefined,
      settleFull: !amount,
      razorpay: {
        order_id: orderId,
        payment_id: paymentId || null,
      },
    });
    return NextResponse.json({ ok: true, kind: 'registration' });
  }

  const { data: donation } = await admin
    .from('donations')
    .select('id')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();

  if (!donation) {
    return NextResponse.json({ ok: true, unmatched: true });
  }

  await applyDonationPayment({
    donationId: donation.id,
    razorpay: {
      order_id: orderId,
      payment_id: paymentId || null,
    },
  });

  return NextResponse.json({ ok: true, kind: 'donation' });
}
