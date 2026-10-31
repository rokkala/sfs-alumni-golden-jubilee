/** @deprecated Prefer check-admin-simple-password.mjs — kept as alias. */
import { adminSimplePassword } from '../lib/auth/admin-simple-password.ts';

const ok = adminSimplePassword({ username: 'sfs', email: 'a@b.com', batch: 1976 });
if (!ok.ok || ok.password !== 'sfs_1976') throw new Error(JSON.stringify(ok));
console.log('ok', ok.password);
