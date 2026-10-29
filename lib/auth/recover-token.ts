import { SignJWT, jwtVerify } from 'jose';

const MAX_AGE_SEC = 15 * 60; // 15 minutes

export type RecoverTokenPayload = {
  accountId: string;
  needsAnswers: boolean;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short');
  }
  return new TextEncoder().encode(secret);
}

export async function createRecoverToken(payload: RecoverTokenPayload): Promise<string> {
  return new SignJWT({
    purpose: 'recover',
    needsAnswers: payload.needsAnswers,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.accountId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

export async function verifyRecoverToken(token: string): Promise<RecoverTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== 'recover') return null;
    const accountId = payload.sub;
    if (!accountId) return null;
    return {
      accountId,
      needsAnswers: Boolean(payload.needsAnswers),
    };
  } catch {
    return null;
  }
}
