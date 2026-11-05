import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { applyDonationPayment } from '@/lib/donations/mark-paid';
import { applyRegistrationPayment } from '@/lib/events/mark-paid';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const decision = String(body.status || '').trim();
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
  }
  const admin_note = String(body.adminNote ?? body.admin_note ?? '').trim() || null;

  const admin = createAdminClient();
  const { data: proof, error } = await admin
    .from('offline_payment_proofs')
    .select(
      'id,source_type,registration_id,donation_id,amount_paise,status'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !proof) {
    return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
  }
  if (proof.status !== 'pending') {
    return NextResponse.json({ error: 'Proof already reviewed' }, { status: 400 });
  }

  if (decision === 'approved') {
    if (proof.source_type === 'registration' && proof.registration_id) {
      const result = await applyRegistrationPayment({
        registrationId: proof.registration_id,
        paymentPaise: proof.amount_paise,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Could not mark registration paid' },
          { status: result.status || 500 }
        );
      }
    } else if (proof.source_type === 'donation' && proof.donation_id) {
      const result = await applyDonationPayment({ donationId: proof.donation_id });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Could not mark donation paid' },
          { status: result.status || 500 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Proof missing source link' }, { status: 400 });
    }
  }

  const { data: updated, error: updErr } = await admin
    .from('offline_payment_proofs')
    .update({
      status: decision,
      admin_note,
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id,status,admin_note,reviewed_at')
    .maybeSingle();

  if (updErr || !updated) {
    console.error('offline proof decide', updErr);
    return NextResponse.json({ error: 'Could not update proof' }, { status: 500 });
  }

  return NextResponse.json({ proof: updated });
}
