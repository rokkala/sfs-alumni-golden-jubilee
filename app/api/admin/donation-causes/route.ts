import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('donation_causes')
    .select('id,title,description,active,sort_order,created_at,updated_at')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    console.error('admin donation causes', error);
    return NextResponse.json({ error: 'Could not load causes' }, { status: 500 });
  }

  return NextResponse.json({ causes: data || [] });
}

export async function POST(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const description = String(body.description || '').trim() || null;
  const active = body.active !== false;
  const sort_order = Math.trunc(Number(body.sort_order) || 0);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('donation_causes')
    .insert({
      title,
      description,
      active,
      sort_order,
      updated_at: new Date().toISOString(),
    })
    .select('id,title,description,active,sort_order,created_at,updated_at')
    .single();

  if (error) {
    console.error('admin donation cause create', error);
    return NextResponse.json({ error: 'Could not create cause' }, { status: 500 });
  }

  return NextResponse.json({ cause: data });
}
