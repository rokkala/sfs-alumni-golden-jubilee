import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || '').trim();

  const admin = createAdminClient();
  let q = admin
    .from('donations')
    .select(
      'id,amount_paise,message,payment_status,razorpay_payment_id,razorpay_order_id,created_at,donation_causes(title),alumni_accounts(full_name,email)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status === 'pending' || status === 'paid' || status === 'failed') {
    q = q.eq('payment_status', status);
  }

  const { data, error } = await q;
  if (error) {
    console.error('admin donations', error);
    return NextResponse.json({ error: 'Could not load donations' }, { status: 500 });
  }

  const donations = (data || []).map((row) => {
    const cause = row.donation_causes as { title?: string } | { title?: string }[] | null;
    const account = row.alumni_accounts as
      | { full_name?: string; email?: string }
      | { full_name?: string; email?: string }[]
      | null;
    const causeRow = Array.isArray(cause) ? cause[0] : cause;
    const accountRow = Array.isArray(account) ? account[0] : account;
    return {
      id: row.id,
      amount_paise: row.amount_paise,
      message: row.message,
      payment_status: row.payment_status,
      razorpay_payment_id: row.razorpay_payment_id,
      razorpay_order_id: row.razorpay_order_id,
      created_at: row.created_at,
      cause_title: causeRow?.title || '—',
      donor_name: accountRow?.full_name || '—',
      donor_email: accountRow?.email || '—',
    };
  });

  return NextResponse.json({ donations });
}
