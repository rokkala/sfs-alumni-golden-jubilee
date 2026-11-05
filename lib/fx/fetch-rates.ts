import { FX_CURRENCIES, normalizeInrRates, type InrRates } from './convert';

/** Free open.er-api.com — no key; rates relative to INR. */
const OPEN_ER_URL = 'https://open.er-api.com/v6/latest/INR';

type CacheEntry = { rates: InrRates; fetchedAt: number; provider: string };

// ponytail: in-memory cache is per-instance (serverless cold starts miss). Upgrade: shared KV/Redis if multi-region lag matters.
let cache: CacheEntry | null = null;
const TTL_MS = 60 * 60 * 1000;

export function clearFxRatesCacheForTests() {
  cache = null;
}

export async function getInrFxRates(now = Date.now()): Promise<{
  rates: InrRates;
  fetchedAt: number;
  provider: string;
  cached: boolean;
}> {
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return { ...cache, cached: true };
  }

  const res = await fetch(OPEN_ER_URL, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`FX provider HTTP ${res.status}`);
  }

  const body = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };

  if (body.result !== 'success' || !body.rates || typeof body.rates !== 'object') {
    throw new Error('FX provider returned unexpected payload');
  }

  const rates = normalizeInrRates(body.rates as Record<string, unknown>);
  for (const code of FX_CURRENCIES) {
    if (code === 'INR') continue;
    if (rates[code] == null) {
      throw new Error(`FX provider missing ${code}`);
    }
  }

  cache = { rates, fetchedAt: now, provider: 'open.er-api.com' };
  return { ...cache, cached: false };
}
