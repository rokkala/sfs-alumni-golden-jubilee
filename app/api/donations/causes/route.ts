import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.member_status !== 'verified') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('donation_causes')
    .select('id,title,description,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    console.error('donation causes', error);
    return NextResponse.json({ error: 'Could not load causes' }, { status: 500 });
  }

  return NextResponse.json({ causes: data || [] });
}
