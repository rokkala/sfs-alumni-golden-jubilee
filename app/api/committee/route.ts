import { NextResponse } from 'next/server';
import { committeePhotoUrl } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    // ponytail: filter published in JS — PostgREST `.eq('published', true)` returned 0 rows
    // on Vercel while unfiltered select showed published:true. Upgrade: fix boolean filter / schema cache.
    const { data, error } = await admin
      .from('committee_members')
      .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order,published')
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('committee list', error);
      return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
    }

    const publishedRows = (data || []).filter((row) => row.published === true);

    const members = await Promise.all(
      publishedRows.map(async (row) => ({
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

    return NextResponse.json({
      members,
      // temporary deploy marker — remove after prod verifies
      _v: 'committee-js-filter-1',
      _n: publishedRows.length,
      _raw: (data || []).length,
    });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
