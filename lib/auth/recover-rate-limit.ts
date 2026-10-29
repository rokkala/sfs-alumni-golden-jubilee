/** ponytail: in-memory rate limit (ceiling ~1k concurrent; upgrade to Redis/KV if multi-instance). */

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  __sfsRecoverBuckets?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!globalStore.__sfsRecoverBuckets) {
    globalStore.__sfsRecoverBuckets = new Map();
  }
  return globalStore.__sfsRecoverBuckets;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function recoverRateLimited(key: string): boolean {
  const now = Date.now();
  const buckets = store();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  existing.count += 1;
  return existing.count > MAX_ATTEMPTS;
}
