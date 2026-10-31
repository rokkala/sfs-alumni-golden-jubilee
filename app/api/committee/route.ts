import { NextResponse } from 'next/server';
import { committeePhotoUrl } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('committee_members')
      .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('committee list', error);
      return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
    }

    const members = await Promise.all(
      (data || []).map(async (row) => ({
        id: row.id,
        full_name: row.full_name,
        role: row.role,
        email: row.email,
        batch: row.batch,
        phone_number: row.phone_number,
        sort_order: row.sort_order,
        photo_url: await committeePhotoUrl(admin, row.photo_path),
      }))
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
