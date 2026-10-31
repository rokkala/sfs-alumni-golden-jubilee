/**
 * Self-check for donation amount/message validation (no DB).
 * Run: node --experimental-strip-types scripts/check-donation-validate.mjs
 */
import {
  assertDonationAmountPaise,
  assertDonationMessage,
  DONATION_AMOUNT_CHIPS_PAISE,
  DONATION_MAX_MESSAGE,
  DONATION_MIN_PAISE,
} from '../lib/donations/validate.ts';

if (DONATION_MIN_PAISE !== 100) throw new Error('min paise');
if (DONATION_AMOUNT_CHIPS_PAISE.join(',') !== '50000,100000,250000,500000') {
  throw new Error('chips');
}

try {
  assertDonationAmountPaise(99);
  throw new Error('expected min fail');
} catch (e) {
  if (!(e instanceof Error) || !/₹1|at least/i.test(e.message)) throw e;
}

if (assertDonationAmountPaise(50000) !== 50000) throw new Error('chip amount');
if (assertDonationMessage('') !== null) throw new Error('empty message');
if (assertDonationMessage('  Thanks  ') !== 'Thanks') throw new Error('trim message');

try {
  assertDonationMessage('x'.repeat(DONATION_MAX_MESSAGE + 1));
  throw new Error('expected message max fail');
} catch (e) {
  if (!(e instanceof Error) || !/message/i.test(e.message)) throw e;
}

console.log('ok: donation validate');
