/**
 * Assert FX conversion math + diaspora currency set (display-only; pay stays INR).
 * Run: node --experimental-strip-types scripts/check-fx.mjs
 */
import {
  FX_CURRENCIES,
  convertPaiseToForeign,
  formatForeignFromPaise,
  normalizeInrRates,
  pickRate,
} from '../lib/fx/convert.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(FX_CURRENCIES[0] === 'INR', 'INR is first / default');
assert(
  FX_CURRENCIES.join(',') === 'INR,USD,EUR,GBP,AED,SGD,AUD,CAD',
  'fixed diaspora set'
);

assert(convertPaiseToForeign(10000, 1) === 100, 'INR rate 1 → rupees');
assert(convertPaiseToForeign(10000, 0.012) === 1.2, '10000 paise × 0.012 = 1.2');
assert(convertPaiseToForeign(0, 0.5) === 0, 'zero paise');
assert(Number.isNaN(convertPaiseToForeign(100, 0)), 'zero rate is invalid');
assert(Number.isNaN(convertPaiseToForeign(100, -1)), 'negative rate invalid');

assert(formatForeignFromPaise(10000, 'INR', 1) === '₹100.00', 'INR display');
assert(formatForeignFromPaise(10000, 'USD', 0.012) === '≈ $1.20 USD', 'USD estimate');
assert(formatForeignFromPaise(10000, 'EUR', 0.011) === '≈ €1.10 EUR', 'EUR estimate');
assert(formatForeignFromPaise(5000, 'GBP', null) === null, 'missing rate → null');
assert(formatForeignFromPaise(5000, 'USD', 0) === null, 'bad rate → null');

const raw = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AED: 0.044,
  SGD: 0.016,
  AUD: 0.018,
  CAD: 0.0165,
  JPY: 1.8, // ignored — not in diaspora set
};
const rates = normalizeInrRates(raw);
assert(rates.INR === 1, 'normalize keeps INR');
assert(rates.USD === 0.012, 'normalize keeps USD');
assert(rates.JPY === undefined, 'drops currencies outside the set');
assert(pickRate(rates, 'USD') === 0.012, 'pickRate USD');
assert(pickRate(rates, 'INR') === 1, 'pickRate INR');
assert(pickRate(rates, 'JPY') === null, 'pickRate unknown → null');
assert(pickRate(null, 'USD') === null, 'pickRate null map');

console.log('check-fx: ok');
