import type { SupabaseClient } from '@supabase/supabase-js';

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const TTL_SEC = 3600;

export function paymentProofObjectPath(
  accountId: string,
  objectId: string,
  ext: string
): string {
  return `${accountId}/${objectId}.${ext}`;
}

export async function signedProofUrl(
  admin: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;
  const { data, error } = await admin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(storagePath, TTL_SEC);
  if (!error && data?.signedUrl) return data.signedUrl;
  return null;
}
