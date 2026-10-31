import { NextResponse } from 'next/server';
import { COMMITTEE_BUCKET } from '@/lib/committee/sign';
import { createPublicClient } from '@/lib/supabase-public';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Prefer anon + RLS policy (published only). Fall back to service role + JS filter.
    let rows: Array<{
      id: string;
      full_name: string;
      role: string;
      email: string;
      batch: number;
      phone_number: string | null;
      photo_path: string | null;
      sort_order: number;
      published?: boolean;
    }> = [];

    try {
      const pub = createPublicClient();
      const { data, error } = await pub
        .from('committee_members')
        .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order')
        .order('sort_order', { ascending: true })
        .order('full_name', { ascending: true });
      if (!error && data) rows = data;
      else if (error) console.error('committee public read', error);
    } catch (err) {
      console.error('committee public client', err);
    }

    if (!rows.length) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('committee_members')
        .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order,published')
        .order('sort_order', { ascending: true })
        .order('full_name', { ascending: true });
      if (error) {
        console.error('committee admin fallback', error);
        return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
      }
      rows = (data || []).filter((row) => row.published === true);
    }

    const admin = createAdminClient();
    const members = await Promise.all(
      rows.map(async (row) => {
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
          sort_order: row.sort_order,
          photo_url,
        };
      })
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
