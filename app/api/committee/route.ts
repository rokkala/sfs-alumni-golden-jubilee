import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMMITTEE_BUCKET } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jwtRole(key: string | undefined): string | null {
  if (!key) return null;
  try {
    const part = key.split('.')[1];
    if (!part) return null;
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('committee_members')
      .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order,published')
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true });

    // Fallback: anon + public-read RLS when service role returns nothing (misconfigured env).
    let source: 'service' | 'anon' = 'service';
    let rows = data || [];
    let listError = error;

    if ((!listError && rows.length === 0) || listError) {
      if (url && anonKey) {
        const anon = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const anonRes = await anon
          .from('committee_members')
          .select('id,full_name,role,email,batch,phone_number,photo_path,sort_order,published')
          .order('sort_order', { ascending: true })
          .order('full_name', { ascending: true });
        if (!anonRes.error && (anonRes.data?.length || 0) > 0) {
          rows = anonRes.data || [];
          listError = null;
          source = 'anon';
        } else if (listError && anonRes.error) {
          console.error('committee list', listError, anonRes.error);
          return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
        }
      } else if (listError) {
        console.error('committee list', listError);
        return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
      }
    }

    const publishedRows = rows.filter((row) => Boolean(row.published));

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

    const supabaseHost = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    })();

    return NextResponse.json({
      members,
      _diag: {
        host: supabaseHost,
        source,
        total: rows.length,
        published: publishedRows.length,
        svcRole: jwtRole(serviceKey),
        anonRole: jwtRole(anonKey),
        svcErr: error?.message || null,
      },
    });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
