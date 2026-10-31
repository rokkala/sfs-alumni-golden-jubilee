import { createAdminClient } from '@/lib/supabase-admin';

type MarkOpts = {
  donationId: string;
  razorpay?: {
    order_id?: string | null;
    payment_id?: string | null;
    signature?: string | null;
  };
};

/**
 * Mark a donation paid. Idempotent when razorpay_payment_id already matches.
 */
export async function applyDonationPayment(opts: MarkOpts): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  payment_status?: string;
  amount_paise?: number;
}> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('donations')
    .select('id,payment_status,amount_paise,razorpay_payment_id')
    .eq('id', opts.donationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, status: 404, error: 'Donation not found' };
  }

  if (
    opts.razorpay?.payment_id &&
    row.razorpay_payment_id &&
    row.razorpay_payment_id === opts.razorpay.payment_id
  ) {
    return {
      ok: true,
      payment_status: row.payment_status,
      amount_paise: Math.max(0, Number(row.amount_paise) || 0),
    };
  }

  if (row.payment_status === 'paid') {
    return {
      ok: true,
      payment_status: 'paid',
      amount_paise: Math.max(0, Number(row.amount_paise) || 0),
    };
  }

  const patch: Record<string, unknown> = {
    payment_status: 'paid',
    updated_at: new Date().toISOString(),
  };
  if (opts.razorpay?.order_id) patch.razorpay_order_id = opts.razorpay.order_id;
  if (opts.razorpay?.payment_id) patch.razorpay_payment_id = opts.razorpay.payment_id;
  if (opts.razorpay?.signature) patch.razorpay_signature = opts.razorpay.signature;

  const { error: updError } = await admin.from('donations').update(patch).eq('id', row.id);
  if (updError) {
    console.error('donation mark-paid', updError);
    return { ok: false, status: 500, error: 'Could not update donation' };
  }

  return {
    ok: true,
    payment_status: 'paid',
    amount_paise: Math.max(0, Number(row.amount_paise) || 0),
  };
}
