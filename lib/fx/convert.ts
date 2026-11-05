/** Display-only FX helpers. Charging stays INR. */

export const FX_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'AUD',
  'CAD',
] as const;

export type FxCurrency = (typeof FX_CURRENCIES)[number];

export type InrRates = Partial<Record<FxCurrency, number>>;

const SYMBOL: Partial<Record<FxCurrency, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
};

export function isFxCurrency(code: string): code is FxCurrency {
  return (FX_CURRENCIES as readonly string[]).includes(code);
}

/** Convert paise → foreign major units using INR→currency rate (1 INR = rate foreign). */
export function convertPaiseToForeign(paise: number, ratePerInr: number): number {
  if (!Number.isFinite(paise) || !Number.isFinite(ratePerInr) || ratePerInr <= 0) {
    return Number.NaN;
  }
  return (paise / 100) * ratePerInr;
}

export function pickRate(rates: InrRates | null | undefined, code: FxCurrency): number | null {
  if (!rates) return null;
  if (code === 'INR') return 1;
  const r = rates[code];
  if (typeof r !== 'number' || !Number.isFinite(r) || r <= 0) return null;
  return r;
}

export function normalizeInrRates(raw: Record<string, unknown>): InrRates {
  const out: InrRates = { INR: 1 };
  for (const code of FX_CURRENCIES) {
    if (code === 'INR') continue;
    const v = raw[code];
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[code] = n;
  }
  return out;
}

/** Estimate string for a selected currency, or null if unavailable. */
export function formatForeignFromPaise(
  paise: number,
  currency: FxCurrency,
  ratePerInr: number | null | undefined
): string | null {
  if (currency === 'INR') {
    if (!Number.isFinite(paise)) return null;
    return `₹${(paise / 100).toFixed(2)}`;
  }
  const rate = typeof ratePerInr === 'number' ? ratePerInr : null;
  if (rate == null || rate <= 0) return null;
  const amount = convertPaiseToForeign(paise, rate);
  if (!Number.isFinite(amount)) return null;
  const symbol = SYMBOL[currency];
  const body = symbol ? `${symbol}${amount.toFixed(2)}` : amount.toFixed(2);
  return `≈ ${body} ${currency}`;
}
