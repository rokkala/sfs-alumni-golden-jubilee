import { NextResponse } from 'next/server';
import { committeePhotoUrl } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function keyClaim(): { role?: string; ref?: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const part = key.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return { role: json.role, ref: json.ref };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
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
      return NextResponse.json(
        { error: 'Could not load committee', detail: error.message, code: error.code },
        { status: 500 }
      );
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

    const url = new URL(request.url);
    if (url.searchParams.get('diag') === '1') {
      return NextResponse.json({
        members,
        diag: {
          count: members.length,
          rawCount: data?.length ?? 0,
          key: keyClaim(),
          urlHost: (() => {
            try {
              return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host;
            } catch {
              return null;
            }
          })(),
        },
      });
    }

    return NextResponse.json({ members });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json(
      { error: 'Could not load committee', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
