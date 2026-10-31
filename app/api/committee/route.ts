import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMMITTEE_BUCKET } from '@/lib/committee/sign';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanEnv(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function jwtClaims(key: string): {
  role: string | null;
  ref: string | null;
  iat: number | null;
  exp: number | null;
  iss: string | null;
} {
  if (!key || !key.includes('.')) {
    return { role: null, ref: null, iat: null, exp: null, iss: null };
  }
  try {
    const part = key.split('.')[1];
    if (!part) return { role: null, ref: null, iat: null, exp: null, iss: null };
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
    return {
      role: typeof payload.role === 'string' ? payload.role : null,
      ref: typeof payload.ref === 'string' ? payload.ref : null,
      iat: typeof payload.iat === 'number' ? payload.iat : null,
      exp: typeof payload.exp === 'number' ? payload.exp : null,
      iss: typeof payload.iss === 'string' ? payload.iss : null,
    };
  } catch {
    return { role: null, ref: null, iat: null, exp: null, iss: null };
  }
}

type CommitteeRow = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  batch: number;
  phone_number: string | null;
  photo_path: string | null;
  sort_order: number;
  published: boolean;
};

const SELECT =
  'id,full_name,role,email,batch,phone_number,photo_path,sort_order,published';

export async function GET() {
  try {
    const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const anonKey = cleanEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
    const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

    let rows: CommitteeRow[] = [];
    let source: 'anon' | 'service' | 'none' = 'none';
    let anonErr: string | null = null;
    let svcErr: string | null = null;
    let svcCount = 0;

    // Prefer anon + public-read RLS — reliable on Vercel for this project.
    if (url && anonKey) {
      const anon = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, { ...init, cache: 'no-store' }),
        },
      });
      const anonRes = await anon
        .from('committee_members')
        .select(SELECT)
        .order('sort_order', { ascending: true })
        .order('full_name', { ascending: true });
      if (anonRes.error) {
        anonErr = anonRes.error.message;
      } else {
        rows = (anonRes.data || []) as CommitteeRow[];
        source = 'anon';
      }
    }

    // Always probe service role (admin path uses it); fall back if anon failed.
    try {
      const admin = createAdminClient();
      const svcRes = await admin
        .from('committee_members')
        .select(SELECT)
        .order('sort_order', { ascending: true })
        .order('full_name', { ascending: true });
      if (svcRes.error) {
        svcErr = svcRes.error.message;
      } else {
        svcCount = (svcRes.data || []).length;
        if (source !== 'anon' || rows.length === 0) {
          rows = (svcRes.data || []) as CommitteeRow[];
          source = 'service';
        }
      }
    } catch (e) {
      svcErr = e instanceof Error ? e.message : 'service client failed';
    }

    if (source === 'none') {
      console.error('committee list', { anonErr, svcErr });
      return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
    }

    const publishedRows = rows.filter((row) => Boolean(row.published));
    const admin = createAdminClient();

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

    return NextResponse.json({
      members,
      _diag: {
        host: (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        })(),
        source,
        total: rows.length,
        published: publishedRows.length,
        svcCount,
        svc: jwtClaims(serviceKey),
        anon: jwtClaims(anonKey),
        svcKeyLen: serviceKey.length,
        anonErr,
        svcErr,
      },
    });
  } catch (err) {
    console.error('committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}
