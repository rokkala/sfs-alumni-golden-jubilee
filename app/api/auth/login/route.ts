import { NextResponse } from 'next/server';
import { findAccountForLogin } from '@/lib/auth/find-account';
import { normalizeLoginId } from '@/lib/auth/identity';
import { verifyPassword } from '@/lib/auth/password';
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.username || body.email || ''));
    const password = String(body.password || '');

    if (!loginId || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const account = await findAccountForLogin(admin, loginId);
    if (!account) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = await createSessionToken({ accountId: account.id, email: account.email });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
    return res;
  } catch (err) {
    console.error('login', err);
    return NextResponse.json({ error: 'Server is not configured for login' }, { status: 500 });
  }
}
