import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { signedProofUrl } from '@/lib/payments/proof-storage';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || 'pending').trim();
  const allowed = new Set(['pending', 'approved', 'rejected', 'all']);
  if (!allowed.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  const admin = createAdminClient();
  let q = admin
    .from('offline_payment_proofs')
    .select(
      'id,source_type,registration_id,donation_id,account_id,payment_account_id,amount_paise,utr,screenshot_path,status,admin_note,created_at,updated_at,reviewed_at,alumni_accounts(full_name,email),payment_accounts(label)'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.error('admin offline proofs', error);
    return NextResponse.json({ error: 'Could not load proofs' }, { status: 500 });
  }

  const proofs = await Promise.all(
    (data || []).map(async (row) => {
      const screenshot_url = await signedProofUrl(admin, row.screenshot_path);
      const account = Array.isArray(row.alumni_accounts)
        ? row.alumni_accounts[0]
        : row.alumni_accounts;
      const payAcct = Array.isArray(row.payment_accounts)
        ? row.payment_accounts[0]
        : row.payment_accounts;
      return {
        id: row.id,
        source_type: row.source_type,
        registration_id: row.registration_id,
        donation_id: row.donation_id,
        amount_paise: row.amount_paise,
        utr: row.utr,
        status: row.status,
        admin_note: row.admin_note,
        created_at: row.created_at,
        reviewed_at: row.reviewed_at,
        screenshot_url,
        donor_name: account?.full_name || '—',
        donor_email: account?.email || '—',
        payment_account_label: payAcct?.label || null,
      };
    })
  );

  return NextResponse.json({ proofs });
}
