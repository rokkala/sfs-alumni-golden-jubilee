import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { COMMITTEE_BUCKET, committeePhotoUrl } from '@/lib/committee/sign';
import {
  assertCommitteeFields,
  assertCommitteeImage,
  committeeObjectPath,
} from '@/lib/committee/validate';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const me = await requireVerifiedAdmin();
    if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('committee_members')
      .select(
        'id,full_name,role,email,batch,phone_number,photo_path,sort_order,published,created_at,updated_at'
      )
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('admin committee list', error);
      return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
    }

    const members = await Promise.all(
      (data || []).map(async (row) => ({
        ...row,
        photo_url: await committeePhotoUrl(admin, row.photo_path),
      }))
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error('admin committee list', err);
    return NextResponse.json({ error: 'Could not load committee' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const me = await requireVerifiedAdmin();
    if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const form = await request.formData();
    let fields;
    try {
      fields = assertCommitteeFields({
        full_name: form.get('full_name'),
        role: form.get('role'),
        email: form.get('email'),
        batch: form.get('batch'),
        phone_number: form.get('phone_number'),
        sort_order: form.get('sort_order'),
        published: form.get('published'),
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid fields' },
        { status: 400 }
      );
    }

    const file = form.get('photo');
    const upload =
      file && typeof file === 'object' && 'arrayBuffer' in file
        ? (file as File)
        : null;

    let photo_path: string | null = null;
    try {
      const ext = assertCommitteeImage(
        upload ? { type: upload.type, size: upload.size } : null,
        false
      );
      if (ext && upload) {
        const id = randomUUID();
        photo_path = committeeObjectPath(id, ext);
        const admin = createAdminClient();
        const buf = Buffer.from(await upload.arrayBuffer());
        const { error: upErr } = await admin.storage
          .from(COMMITTEE_BUCKET)
          .upload(photo_path, buf, { contentType: upload.type, upsert: false });
        if (upErr) {
          console.error('committee upload', upErr);
          return NextResponse.json({ error: 'Could not upload photo' }, { status: 500 });
        }
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid photo' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('committee_members')
      .insert({
        ...fields,
        photo_path,
        updated_at: new Date().toISOString(),
      })
      .select(
        'id,full_name,role,email,batch,phone_number,photo_path,sort_order,published,created_at,updated_at'
      )
      .single();

    if (error) {
      console.error('admin committee create', error);
      return NextResponse.json(
        { error: 'Could not create. Run the committee_members migration if this is new.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      member: {
        ...data,
        photo_url: await committeePhotoUrl(admin, data.photo_path),
      },
    });
  } catch (err) {
    console.error('admin committee create', err);
    return NextResponse.json({ error: 'Could not create member' }, { status: 500 });
  }
}
