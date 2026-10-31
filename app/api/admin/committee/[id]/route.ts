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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function updateMember(request: Request, id: string) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  let fieldsInput: Record<string, unknown>;
  let upload: File | null = null;
  let clearPhoto = false;

  if (isMultipart) {
    const form = await request.formData();
    fieldsInput = {
      full_name: form.get('full_name'),
      role: form.get('role'),
      email: form.get('email'),
      batch: form.get('batch'),
      phone_number: form.get('phone_number'),
      bio: form.get('bio'),
      sort_order: form.get('sort_order'),
      published: form.get('published'),
    };
    clearPhoto = form.get('clear_photo') === 'true' || form.get('clear_photo') === '1';
    const file = form.get('photo');
    upload =
      file && typeof file === 'object' && 'arrayBuffer' in file && (file as File).size > 0
        ? (file as File)
        : null;
  } else {
    const body = await request.json().catch(() => ({}));
    fieldsInput = body;
    clearPhoto = Boolean(body.clear_photo);
  }

  let fields;
  try {
    fields = assertCommitteeFields(fieldsInput);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid fields' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: existing, error: findErr } = await admin
    .from('committee_members')
    .select('id,photo_path')
    .eq('id', id)
    .maybeSingle();

  if (findErr || !existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  let photo_path: string | null = existing.photo_path;

  try {
    if (clearPhoto && !upload) {
      if (photo_path) {
        await admin.storage.from(COMMITTEE_BUCKET).remove([photo_path]);
      }
      photo_path = null;
    } else if (upload) {
      const ext = assertCommitteeImage({ type: upload.type, size: upload.size }, true);
      const newPath = committeeObjectPath(randomUUID(), ext!);
      const buf = Buffer.from(await upload.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(COMMITTEE_BUCKET)
        .upload(newPath, buf, { contentType: upload.type, upsert: false });
      if (upErr) {
        console.error('committee upload', upErr);
        return NextResponse.json({ error: 'Could not upload photo' }, { status: 500 });
      }
      if (photo_path) {
        await admin.storage.from(COMMITTEE_BUCKET).remove([photo_path]);
      }
      photo_path = newPath;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid photo' },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from('committee_members')
    .update({
      ...fields,
      photo_path,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id,full_name,role,email,batch,phone_number,bio,photo_path,sort_order,published,created_at,updated_at'
    )
    .single();

  if (error) {
    console.error('admin committee patch', error);
    return NextResponse.json({ error: 'Could not update' }, { status: 500 });
  }

  return NextResponse.json({
    member: {
      ...data,
      photo_url: await committeePhotoUrl(admin, data.photo_path),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await updateMember(request, String(params.id || ''));
  } catch (err) {
    console.error('admin committee patch', err);
    return NextResponse.json({ error: 'Could not update' }, { status: 500 });
  }
}

/** POST also updates — more reliable than multipart PATCH in some browsers/proxies. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await updateMember(request, String(params.id || ''));
  } catch (err) {
    console.error('admin committee update', err);
    return NextResponse.json({ error: 'Could not update' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const me = await requireVerifiedAdmin();
    if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = String(params.id || '');
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('committee_members')
      .select('id,photo_path')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (existing.photo_path) {
      await admin.storage.from(COMMITTEE_BUCKET).remove([existing.photo_path]);
    }

    const { error } = await admin.from('committee_members').delete().eq('id', id);
    if (error) {
      console.error('admin committee delete', error);
      return NextResponse.json({ error: 'Could not delete' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('admin committee delete', err);
    return NextResponse.json({ error: 'Could not delete' }, { status: 500 });
  }
}
