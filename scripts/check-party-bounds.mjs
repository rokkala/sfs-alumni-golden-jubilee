/**
 * Self-check for event party min/max helpers.
 * Run: node scripts/check-party-bounds.mjs
 */
import assert from 'assert';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';

// Load TS via dynamic transpile-free duplicate of logic (keep in sync with lib/events/party-bounds.ts)
const DEFAULT_PARTY_MIN = 1;
const DEFAULT_PARTY_MAX = 20;

function eventPartyBounds(event) {
  let min = Math.floor(Number(event?.party_min));
  if (!Number.isFinite(min) || min < 0) min = DEFAULT_PARTY_MIN;
  let max = Math.floor(Number(event?.party_max));
  if (!Number.isFinite(max) || max < 0) max = DEFAULT_PARTY_MAX;
  if (max < min) max = min;
  return { min, max };
}

function clampPartySize(raw, bounds) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return bounds.min;
  if (n < bounds.min) return bounds.min;
  if (n > bounds.max) return bounds.max;
  return n;
}

assert.deepEqual(eventPartyBounds(null), { min: 1, max: 20 });
assert.deepEqual(eventPartyBounds({ party_min: 0, party_max: 8 }), { min: 0, max: 8 });
assert.deepEqual(eventPartyBounds({ party_min: 2, party_max: 8 }), { min: 2, max: 8 });
assert.deepEqual(eventPartyBounds({ party_min: 5, party_max: 3 }), { min: 5, max: 5 });
assert.equal(clampPartySize(0, { min: 0, max: 6 }), 0);
assert.equal(clampPartySize(0, { min: 2, max: 6 }), 2);
assert.equal(clampPartySize(99, { min: 2, max: 6 }), 6);
assert.equal(clampPartySize(4, { min: 2, max: 6 }), 4);

console.log('PASS party-bounds self-check');
