import type { SupabaseClient } from '@supabase/supabase-js';

export const COMMITTEE_BUCKET = 'committee-photos';
const TTL_SEC = 3600 * 24;

export async function committeePhotoUrl(
  admin: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;
  const { data: pub } = admin.storage.from(COMMITTEE_BUCKET).getPublicUrl(storagePath);
  if (pub?.publicUrl) return pub.publicUrl;
  const { data, error } = await admin.storage
    .from(COMMITTEE_BUCKET)
    .createSignedUrl(storagePath, TTL_SEC);
  if (!error && data?.signedUrl) return data.signedUrl;
  return null;
}
