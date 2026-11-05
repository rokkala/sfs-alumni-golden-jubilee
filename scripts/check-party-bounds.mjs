/**
 * Self-check for event party min/max helpers.
 * Run: node --experimental-strip-types scripts/check-party-bounds.mjs
 */
import assert from 'assert';
import {
  clampPartySize,
  clampPartySplit,
  eventPartyBounds,
  MAX_ALUMNI_PER_REGISTRATION,
} from '../lib/events/party-bounds.ts';

assert.equal(MAX_ALUMNI_PER_REGISTRATION, 1, 'alumni per registration is 0 or 1');
assert.deepEqual(eventPartyBounds(null), { min: 1, max: 20 });
assert.deepEqual(eventPartyBounds({ party_min: 0, party_max: 8 }), { min: 0, max: 8 });
assert.deepEqual(eventPartyBounds({ party_min: 2, party_max: 8 }), { min: 2, max: 8 });
assert.deepEqual(eventPartyBounds({ party_min: 5, party_max: 3 }), { min: 5, max: 5 });
assert.equal(clampPartySize(0, { min: 0, max: 6 }), 0);
assert.equal(clampPartySize(0, { min: 2, max: 6 }), 2);
assert.equal(clampPartySize(99, { min: 2, max: 6 }), 6);
assert.equal(clampPartySize(4, { min: 2, max: 6 }), 4);

const capped = clampPartySplit(5, 2, { min: 1, max: 20 });
assert.equal(capped.people, 1, 'alumni capped at 1');
assert.equal(capped.guests, 2, 'guests unchanged when under max');
assert.equal(capped.total, 3, 'total = 1 alumni + guests');

const zeroOk = clampPartySplit(0, 0, { min: 0, max: 8 });
assert.equal(zeroOk.people, 0, 'alumni may be 0 when party min is 0');

const forceOne = clampPartySplit(0, 3, { min: 1, max: 8 });
assert.equal(forceOne.people, 1, 'min≥1 forces one alumnus');

console.log('PASS party-bounds self-check');
