/**
 * Assert login id matching covers packed-bio usernames when column is null.
 * Run: node scripts/check-find-account.mjs
 */
import assert from 'assert';

const PROFILE_PACK = 'sfs1:';

function readPackedProfile(bio) {
  if (typeof bio !== 'string' || !bio.startsWith(PROFILE_PACK)) return null;
  try {
    const parsed = JSON.parse(bio.slice(PROFILE_PACK.length));
    return { username: typeof parsed.username === 'string' ? parsed.username : '' };
  } catch {
    return null;
  }
}

function matchesLoginId(row, loginId) {
  if (row.email === loginId) return true;
  if (row.username === loginId) return true;
  const packed = readPackedProfile(row.bio)?.username;
  return Boolean(packed && packed === loginId);
}

const adminRow = {
  email: 'rokkala123@gmail.com',
  username: null,
  bio: PROFILE_PACK + JSON.stringify({ section: '', lastName: 'Committee', firstName: 'SFS', username: 'admin' }),
};

assert.equal(matchesLoginId(adminRow, 'admin'), true, 'packed admin');
assert.equal(matchesLoginId(adminRow, 'rokkala123@gmail.com'), true, 'email');
assert.equal(matchesLoginId(adminRow, 'nope'), false, 'miss');
assert.equal(
  matchesLoginId({ email: 'a@b.c', username: 'rokkala', bio: null }, 'rokkala'),
  true,
  'column username'
);

console.log('PASS find-account match self-check');
