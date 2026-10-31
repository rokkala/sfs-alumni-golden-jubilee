import { NextResponse } from 'next/server';
import { COMMITTEE_BUCKET } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    // Always use service role; filter published in JS (PostgREST boolean .eq was unreliable on Vercel).
    const { data, error } = await admin
      .from('committee_members')
      .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order,published')
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('committee list', error);
      return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
    }

    const publishedRows = (data || []).filter((row) => Boolean(row.published));

    const members = publishedRows.map((row) => {
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
    });

    // Temporary deploy check — remove once Association list is confirmed on Vercel.
    const supabaseHost = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname;
      } catch {
        return null;
      }
    })();

    return NextResponse.json({
      members,
      _diag: {
        host: supabaseHost,
        total: (data || []).length,
        published: publishedRows.length,
      },
    });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
