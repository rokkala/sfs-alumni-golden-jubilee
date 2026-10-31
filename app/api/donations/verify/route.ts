import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { applyDonationPayment } from '@/lib/donations/mark-paid';
import { verifyCheckoutSignature } from '@/lib/payments/razorpay';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.razorpay_order_id || '').trim();
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();
  const donationId = String(body.donationId || '').trim();

  if (!orderId || !paymentId || !signature || !donationId) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
  }

  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: donation, error } = await admin
    .from('donations')
    .select('id,account_id,razorpay_order_id,amount_paise,payment_status')
    .eq('id', donationId)
    .eq('account_id', me.id)
    .maybeSingle();

  if (error || !donation) {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
  }

  if (donation.razorpay_order_id && donation.razorpay_order_id !== orderId) {
    return NextResponse.json({ error: 'Order does not match this donation' }, { status: 400 });
  }

  const result = await applyDonationPayment({
    donationId: donation.id,
    razorpay: {
      order_id: orderId,
      payment_id: paymentId,
      signature,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Could not confirm donation' },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    payment_status: result.payment_status,
    amount_paise: result.amount_paise,
  });
}
