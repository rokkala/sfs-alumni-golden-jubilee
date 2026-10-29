/**
 * Self-check for recovery helpers (no DB).
 * Run: node --experimental-strip-types scripts/check-recovery.mjs
 * (falls back to asserting against lib/auth/recovery.ts via strip-types)
 */
import {
  RECOVERY_QUESTIONS,
  normalizeRecoveryAnswer,
  phoneLast4Matches,
  batchMatches,
  validateQuestionPick,
  recoveryConfigured,
} from '../lib/auth/recovery.ts';

if (RECOVERY_QUESTIONS.length < 12) throw new Error('expected at least 12 questions');
const ids = new Set(RECOVERY_QUESTIONS.map((q) => q.id));
if (ids.size !== RECOVERY_QUESTIONS.length) throw new Error('duplicate question ids');

if (normalizeRecoveryAnswer('  Foo   BAR ') !== 'foo bar') {
  throw new Error('normalize should collapse case/space');
}
if (normalizeRecoveryAnswer('') !== '') throw new Error('empty stays empty');

if (!phoneLast4Matches('3210', '+919876543210')) throw new Error('last4 should match E.164');
if (!phoneLast4Matches('3210', '09876543210')) throw new Error('last4 national');
if (phoneLast4Matches('1111', '+919876543210')) throw new Error('wrong last4');
if (phoneLast4Matches('876', '+919876543210')) throw new Error('need exactly 4 digits');
if (phoneLast4Matches('3210', '')) throw new Error('no phone on file');

if (!batchMatches(null, '1990')) throw new Error('null batch ignores input');
if (!batchMatches(1990, '1990')) throw new Error('batch match');
if (batchMatches(1990, '1991')) throw new Error('batch mismatch');
if (batchMatches(1990, '')) throw new Error('batch required when set');

const pickOk = validateQuestionPick(['mother_maiden', 'first_school']);
if (pickOk) throw new Error(pickOk);
const pickDup = validateQuestionPick(['mother_maiden', 'mother_maiden']);
if (!pickDup) throw new Error('reject duplicate picks');
const pickOne = validateQuestionPick(['mother_maiden']);
if (!pickOne) throw new Error('require exactly 2');
const pickBad = validateQuestionPick(['mother_maiden', 'not_a_real_id']);
if (!pickBad) throw new Error('reject unknown id');

if (
  !recoveryConfigured({
    recovery_q1: 'mother_maiden',
    recovery_a1_hash: 'x',
    recovery_q2: 'first_school',
    recovery_a2_hash: 'y',
  })
) {
  throw new Error('configured when all set');
}
if (
  recoveryConfigured({
    recovery_q1: 'mother_maiden',
    recovery_a1_hash: 'x',
    recovery_q2: null,
    recovery_a2_hash: null,
  })
) {
  throw new Error('not configured when incomplete');
}

console.log('ok: recovery helpers');
