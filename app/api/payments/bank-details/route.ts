import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/** Public: active offline bank / UPI account for payment options. */
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('payment_accounts')
    .select('id,label,account_name,account_number,ifsc,bank_name,upi_id')
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('bank-details', error);
    return NextResponse.json({ error: 'Could not load bank details' }, { status: 500 });
  }

  return NextResponse.json({ account: data || null });
}
