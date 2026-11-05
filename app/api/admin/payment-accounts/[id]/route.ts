import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { assertPaymentAccountInput, normalizeIfsc } from '@/lib/payments/bank-details';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT =
  'id,label,account_name,account_number,ifsc,bank_name,upi_id,active,sort_order,created_at,updated_at';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = String(params.id || '');
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Full replace when label present (form save); otherwise allow active-only toggle.
  if (body.label !== undefined || body.accountName !== undefined || body.account_name !== undefined) {
    try {
      const fields = assertPaymentAccountInput({
        ...body,
        active: body.active !== undefined ? body.active : false,
      } as Record<string, unknown>);
      Object.assign(patch, fields);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid account' },
        { status: 400 }
      );
    }
  } else {
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      patch.sort_order = Math.trunc(Number(body.sortOrder ?? body.sort_order) || 0);
    }
    if (body.ifsc !== undefined) {
      const ifsc = normalizeIfsc(body.ifsc);
      if (!ifsc) return NextResponse.json({ error: 'Valid IFSC is required' }, { status: 400 });
      patch.ifsc = ifsc;
    }
  }

  const admin = createAdminClient();

  if (patch.active === true) {
    const { error: clearErr } = await admin
      .from('payment_accounts')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('active', true)
      .neq('id', id);
    if (clearErr) {
      console.error('admin payment account clear active', clearErr);
      return NextResponse.json({ error: 'Could not update account' }, { status: 500 });
    }
  }

  const { data, error } = await admin
    .from('payment_accounts')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .maybeSingle();

  if (error || !data) {
    console.error('admin payment account patch', error);
    return NextResponse.json({ error: 'Could not update account' }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
