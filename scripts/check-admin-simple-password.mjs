/**
 * Self-check for admin username_batch temp password.
 * Run: node --experimental-strip-types scripts/check-admin-simple-password.mjs
 */
import { adminSimplePassword } from '../lib/auth/admin-simple-password.ts';

const ok = adminSimplePassword({
  username: 'Rokkala',
  email: 'other@example.com',
  batch: 1995,
});
if (!ok.ok || ok.password !== 'rokkala_1995') throw new Error(`got ${JSON.stringify(ok)}`);

const fromEmail = adminSimplePassword({
  username: '',
  email: 'Jane.Doe@Gmail.com',
  batch: 2001,
});
if (!fromEmail.ok || fromEmail.password !== 'jane.doe_2001') {
  throw new Error(`email local ${JSON.stringify(fromEmail)}`);
}

const noBatch = adminSimplePassword({ username: 'x', email: 'x@y.com', batch: null });
if (noBatch.ok) throw new Error('expected batch fail');

console.log('ok: admin simple password');
