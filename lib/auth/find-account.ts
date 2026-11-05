import { readPackedProfile } from '@/lib/registration-fields';
import { createAdminClient } from '@/lib/supabase-admin';

function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message || '';
  return error.code === 'PGRST204' || error.code === '42703' || /column/i.test(message);
}

export type LoginAccountRow = {
  id: string;
  email: string;
  password_hash: string;
};

export type RecoverAccountRow = {
  id: string;
  email: string;
  phone_number: string | null;
  batch: number | null;
  recovery_q1: string | null;
  recovery_a1_hash: string | null;
  recovery_q2: string | null;
  recovery_a2_hash: string | null;
};

const LOGIN_SELECT = 'id,email,password_hash';
const RECOVER_SELECT =
  'id,email,phone_number,batch,recovery_q1,recovery_a1_hash,recovery_q2,recovery_a2_hash';

type Admin = ReturnType<typeof createAdminClient>;

function matchesLoginId(
  row: { email?: string | null; username?: string | null; bio?: string | null },
  loginId: string
): boolean {
  if (row.email === loginId) return true;
  if (row.username === loginId) return true;
  const packed = readPackedProfile(row.bio)?.username;
  return Boolean(packed && packed === loginId);
}

/** Lookup by username column, then email, then packed bio username (legacy null username). */
export async function findAccountForLogin(
  admin: Admin,
  loginId: string
): Promise<LoginAccountRow | null> {
  const byUsername = await admin
    .from('alumni_accounts')
    .select(LOGIN_SELECT)
    .eq('username', loginId)
    .maybeSingle();
  if (!byUsername.error && byUsername.data) return byUsername.data as LoginAccountRow;

  if (byUsername.error && missingColumn(byUsername.error)) {
    return findLoginLegacy(admin, loginId);
  }

  if (loginId.includes('@')) {
    const byEmail = await admin
      .from('alumni_accounts')
      .select(LOGIN_SELECT)
      .eq('email', loginId)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data as LoginAccountRow;
  }

  // username column exists but is null on older rows; packed bio still has the handle
  return findLoginLegacy(admin, loginId);
}

async function findLoginLegacy(admin: Admin, loginId: string): Promise<LoginAccountRow | null> {
  // ponytail: O(n) scan when username miss / column missing. Ceiling: alumni roster size; upgrade: backfill username.
  const { data } = await admin.from('alumni_accounts').select('id,email,password_hash,bio,username');
  const match = (data || []).find((row) => matchesLoginId(row, loginId));
  return match
    ? {
        id: String(match.id),
        email: String(match.email),
        password_hash: String(match.password_hash),
      }
    : null;
}

/** Lookup by username, then email, then packed bio. Used by recover flows. */
export async function findAccountForRecover(
  admin: Admin,
  loginId: string
): Promise<RecoverAccountRow | null> {
  const byUsername = await admin
    .from('alumni_accounts')
    .select(RECOVER_SELECT)
    .eq('username', loginId)
    .maybeSingle();
  if (!byUsername.error && byUsername.data) return normalizeRecoverRow(byUsername.data);

  if (byUsername.error && missingColumn(byUsername.error)) {
    return findAccountLegacy(admin, loginId);
  }

  if (loginId.includes('@')) {
    const byEmail = await admin
      .from('alumni_accounts')
      .select(RECOVER_SELECT)
      .eq('email', loginId)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) return normalizeRecoverRow(byEmail.data);
    if (byEmail.error && missingColumn(byEmail.error)) {
      return findAccountLegacy(admin, loginId);
    }
  }

  return findAccountLegacy(admin, loginId);
}

function normalizeRecoverRow(row: Record<string, unknown>): RecoverAccountRow {
  return {
    id: String(row.id),
    email: String(row.email),
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
    batch: row.batch != null ? Number(row.batch) : null,
    recovery_q1: row.recovery_q1 != null ? String(row.recovery_q1) : null,
    recovery_a1_hash: row.recovery_a1_hash != null ? String(row.recovery_a1_hash) : null,
    recovery_q2: row.recovery_q2 != null ? String(row.recovery_q2) : null,
    recovery_a2_hash: row.recovery_a2_hash != null ? String(row.recovery_a2_hash) : null,
  };
}

async function findAccountLegacy(admin: Admin, loginId: string): Promise<RecoverAccountRow | null> {
  // ponytail: scans when username/recovery columns missing or username null. Upgrade: backfill username.
  const { data } = await admin
    .from('alumni_accounts')
    .select('id,email,phone_number,batch,bio,username,recovery_q1,recovery_a1_hash,recovery_q2,recovery_a2_hash');
  const match = (data || []).find((row) => matchesLoginId(row, loginId));
  return match ? normalizeRecoverRow(match) : null;
}
