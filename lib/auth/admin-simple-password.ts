/**
 * Admin-only temporary password: `{username}_{batch}`.
 * Username = stored username, else email local-part (before @).
 */
export function adminSimplePassword(input: {
  username?: string | null;
  email: string;
  batch: number | null | undefined;
}): { ok: true; password: string } | { ok: false; error: string } {
  const batch = Number(input.batch);
  if (!Number.isFinite(batch) || batch < 1900 || batch > 2100) {
    return { ok: false, error: 'Member needs a valid batch year before this reset' };
  }

  const stored = String(input.username || '')
    .trim()
    .toLowerCase();
  const email = String(input.email || '')
    .trim()
    .toLowerCase();
  const local = email.includes('@') ? email.slice(0, email.indexOf('@')) : email;
  const user = (stored || local).replace(/[^a-z0-9._]/g, '');
  if (!user) {
    return { ok: false, error: 'Member needs a username or email for this reset' };
  }

  const password = `${user}_${Math.trunc(batch)}`;
  if (password.length < 4) {
    return { ok: false, error: 'Could not build a usable temporary password' };
  }
  return { ok: true, password };
}
