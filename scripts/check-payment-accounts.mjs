/**
 * Assert bank/UPI helpers: UPI pay URI shape + only-one-active exclusivity.
 * Run: node --experimental-strip-types scripts/check-payment-accounts.mjs
 */
import {
  buildUpiPayUri,
  normalizeIfsc,
  pickActiveAccount,
  withExclusiveActive,
} from '../lib/payments/bank-details.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeIfsc('sbin0001234') === 'SBIN0001234', 'IFSC uppercases');
assert(normalizeIfsc('  HDFC0000123 ') === 'HDFC0000123', 'IFSC trims');
assert(normalizeIfsc('bad') === null, 'short IFSC rejected');
assert(normalizeIfsc('SBIN1001234') === null, '5th char must be 0');

const uri = buildUpiPayUri({
  upiId: 'school@oksbi',
  payeeName: 'SFS Alumni',
  amountPaise: 150050,
  note: 'Jubilee reg',
});
assert(uri.startsWith('upi://pay?'), 'upi scheme');
assert(uri.includes('pa=school%40oksbi') || uri.includes('pa=school@oksbi'), 'pa = VPA');
assert(uri.includes('am=1500.50'), 'am in rupees with paise');
assert(uri.includes('cu=INR'), 'INR currency');
assert(buildUpiPayUri({ upiId: '', amountPaise: 100 }) === null, 'empty VPA → null');
assert(buildUpiPayUri({ upiId: 'a@b', amountPaise: 0 }) === null, 'zero amount → null');

const none = pickActiveAccount([
  { id: '1', active: false, label: 'A' },
  { id: '2', active: false, label: 'B' },
]);
assert(none === null, 'no active → null');

const one = pickActiveAccount([
  { id: '1', active: false, label: 'A' },
  { id: '2', active: true, label: 'B' },
]);
assert(one?.id === '2', 'picks the active row');

const activated = withExclusiveActive(
  [
    { id: '1', active: true, label: 'A' },
    { id: '2', active: false, label: 'B' },
  ],
  '2'
);
assert(activated.find((a) => a.id === '2')?.active === true, 'target becomes active');
assert(activated.find((a) => a.id === '1')?.active === false, 'others deactivate');
assert(activated.filter((a) => a.active).length === 1, 'exactly one active');

console.log('check-payment-accounts: ok');
