import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { assertPaymentAccountInput } from '@/lib/payments/bank-details';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SELECT =
  'id,label,account_name,account_number,ifsc,bank_name,upi_id,active,sort_order,created_at,updated_at';

export async function GET() {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('payment_accounts')
    .select(SELECT)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    console.error('admin payment accounts', error);
    return NextResponse.json({ error: 'Could not load payment accounts' }, { status: 500 });
  }

  return NextResponse.json({ accounts: data || [] });
}

export async function POST(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  let fields;
  try {
    fields = assertPaymentAccountInput(body as Record<string, unknown>);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid account' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  if (fields.active) {
    const { error: clearErr } = await admin
      .from('payment_accounts')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('active', true);
    if (clearErr) {
      console.error('admin payment accounts clear active', clearErr);
      return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
    }
  }

  const { data, error } = await admin
    .from('payment_accounts')
    .insert({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .select(SELECT)
    .single();

  if (error) {
    console.error('admin payment account create', error);
    return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
