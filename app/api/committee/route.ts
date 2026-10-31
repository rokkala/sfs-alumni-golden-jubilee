import { NextResponse } from 'next/server';
import { COMMITTEE_BUCKET } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('committee_members')
      .select('id,full_name,role,email,batch,phone_number,bio,photo_path,sort_order,published')
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('committee list', error);
      return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
    }

    const members = (data || [])
      .filter((row) => Boolean(row.published))
      .map((row) => {
        let photo_url: string | null = null;
        if (row.photo_path) {
          const { data: pub } = admin.storage.from(COMMITTEE_BUCKET).getPublicUrl(row.photo_path);
          photo_url = pub?.publicUrl || null;
        }
        return {
          id: row.id,
          full_name: row.full_name,
          role: row.role,
          email: row.email,
          batch: row.batch,
          phone_number: row.phone_number,
          bio: row.bio || null,
          sort_order: row.sort_order,
          photo_url,
        };
      });

    return NextResponse.json({ members });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
