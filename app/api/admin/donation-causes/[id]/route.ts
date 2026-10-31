import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    patch.title = title;
  }
  if (body.description !== undefined) {
    patch.description = String(body.description || '').trim() || null;
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.sort_order !== undefined) patch.sort_order = Math.trunc(Number(body.sort_order) || 0);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('donation_causes')
    .update(patch)
    .eq('id', id)
    .select('id,title,description,active,sort_order,created_at,updated_at')
    .maybeSingle();

  if (error || !data) {
    console.error('admin donation cause patch', error);
    return NextResponse.json({ error: 'Could not update cause' }, { status: 500 });
  }

  return NextResponse.json({ cause: data });
}
