/**
 * Self-check for committee member field validation (no DB).
 * Run: node --experimental-strip-types scripts/check-committee-validate.mjs
 */
import {
  assertCommitteeFields,
  committeeObjectPath,
} from '../lib/committee/validate.ts';

try {
  assertCommitteeFields({
    full_name: '',
    role: 'President',
    email: 'a@b.com',
    batch: 1990,
  });
  throw new Error('expected name required');
} catch (e) {
  if (!(e instanceof Error) || !/name/i.test(e.message)) throw e;
}

const ok = assertCommitteeFields({
  full_name: 'Jane Doe',
  role: 'Secretary',
  email: 'jane@example.com',
  batch: '1995',
  phone_number: '',
  bio: '  Helps with events.  ',
  sort_order: '2',
  published: 'true',
});
if (ok.full_name !== 'Jane Doe' || ok.batch !== 1995 || ok.phone_number !== null) {
  throw new Error('bad normalize');
}
if (ok.bio !== 'Helps with events.') throw new Error('bad bio');
if (!ok.published || ok.sort_order !== 2) throw new Error('bad flags');

try {
  assertCommitteeFields({
    full_name: 'X',
    role: 'Y',
    email: 'x@y.com',
    batch: 1990,
    bio: 'x'.repeat(281),
  });
  throw new Error('expected bio fail');
} catch (e) {
  if (!(e instanceof Error) || !/bio/i.test(e.message)) throw e;
}

try {
  assertCommitteeFields({
    full_name: 'X',
    role: 'Y',
    email: 'not-an-email',
    batch: 1990,
  });
  throw new Error('expected email fail');
} catch (e) {
  if (!(e instanceof Error) || !/email/i.test(e.message)) throw e;
}

const path = committeeObjectPath('abc-id', 'jpg');
if (path !== 'members/abc-id.jpg') throw new Error(`bad path ${path}`);

console.log('ok: committee validate');
