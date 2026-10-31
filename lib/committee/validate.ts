const MAX_NAME = 120;
const MAX_ROLE = 80;
const MAX_BIO = 280;
const MAX_BYTES = 4_000_000;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export { MAX_BYTES as COMMITTEE_MAX_BYTES };

export type CommitteeFields = {
  full_name: string;
  role: string;
  email: string;
  batch: number;
  phone_number: string | null;
  bio: string | null;
  sort_order: number;
  published: boolean;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Throws Error with admin-facing message when invalid. */
export function assertCommitteeFields(input: {
  full_name?: unknown;
  role?: unknown;
  email?: unknown;
  batch?: unknown;
  phone_number?: unknown;
  bio?: unknown;
  sort_order?: unknown;
  published?: unknown;
}): CommitteeFields {
  const full_name = String(input.full_name ?? '').trim();
  if (!full_name) throw new Error('Name is required');
  if (full_name.length > MAX_NAME) throw new Error(`Name must be ${MAX_NAME} characters or fewer`);

  const role = String(input.role ?? '').trim();
  if (!role) throw new Error('Role is required');
  if (role.length > MAX_ROLE) throw new Error(`Role must be ${MAX_ROLE} characters or fewer`);

  const email = String(input.email ?? '').trim().toLowerCase();
  if (!email || !isEmail(email)) throw new Error('A valid email is required');

  const batchNum = Number(String(input.batch ?? '').trim());
  if (!Number.isFinite(batchNum) || batchNum < 1900 || batchNum > 2100) {
    throw new Error('Batch must be a year between 1900 and 2100');
  }

  const phoneRaw = String(input.phone_number ?? '').trim();
  const phone_number = phoneRaw ? phoneRaw.replace(/[^\d+]/g, '') : null;
  if (phone_number && phone_number.replace(/\D/g, '').length < 7) {
    throw new Error('Phone number looks too short');
  }

  const bioRaw = String(input.bio ?? '').trim();
  if (bioRaw.length > MAX_BIO) {
    throw new Error(`Bio must be ${MAX_BIO} characters or fewer`);
  }
  const bio = bioRaw || null;

  const sortRaw = input.sort_order;
  const sort_order =
    sortRaw === undefined || sortRaw === null || String(sortRaw).trim() === ''
      ? 0
      : Math.trunc(Number(sortRaw));
  if (!Number.isFinite(sort_order)) throw new Error('Sort order must be a number');

  const published =
    input.published === true ||
    input.published === 'true' ||
    input.published === '1' ||
    input.published === 1;

  return {
    full_name,
    role,
    email,
    batch: Math.trunc(batchNum),
    phone_number,
    bio,
    sort_order,
    published,
  };
}

export function assertCommitteeImage(
  file: { type: string; size: number } | null | undefined,
  required: boolean
): string | null {
  if (!file) {
    if (required) throw new Error('Photo is required');
    return null;
  }
  if (file.size > MAX_BYTES) throw new Error('Image must be 4 MB or smaller');
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error('Image type must be JPEG, PNG, or WebP');
  return ext;
}

export function committeeObjectPath(objectId: string, ext: string): string {
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  return `members/${objectId}.${cleanExt}`;
}
