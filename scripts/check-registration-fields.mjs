import {
  batchYears,
  formatLocation,
  isValidBatch,
  isValidSection,
  parseLocation,
  packProfileFields,
  readPackedProfile,
  mergeProfilePack,
  BATCH_START_YEAR,
} from '../lib/registration-fields.ts';
import { COUNTRIES, isKnownCountry } from '../lib/countries.ts';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}

assert(BATCH_START_YEAR === 1986, 'batch start');
assert(batchYears(1988).join(',') === '1988,1987,1986', 'batch years desc');
assert(isValidBatch(1986) && isValidBatch(new Date().getFullYear()) && !isValidBatch(1985), 'batch bounds');
assert(isValidSection('A') && isValidSection('D') && !isValidSection('E'), 'sections');
assert(formatLocation('Hyderabad', 'India') === 'Hyderabad, India', 'format location');
assert(formatLocation('', 'India') === '', 'format needs city');
const parsed = parseLocation('Hyderabad, India');
assert(parsed.city === 'Hyderabad' && parsed.country === 'India', 'parse location');
const packed = packProfileFields('A', 'Rao');
const unpacked = readPackedProfile(packed);
assert(unpacked && unpacked.section === 'A' && unpacked.lastName === 'Rao', 'pack section');
const kept = readPackedProfile(
  mergeProfilePack(packProfileFields('A', 'Rao', { firstName: 'Ada', username: 'ada.rao' }), {
    section: 'B',
  })
);
assert(kept?.section === 'B' && kept.username === 'ada.rao' && kept.firstName === 'Ada', 'pack keeps username');
assert(readPackedProfile('real bio') === null, 'plain bio is not a section');
assert(isKnownCountry('India') && !isKnownCountry('Narnia'), 'country list');
assert(COUNTRIES.length > 190, 'full country list size');

console.log('PASS registration fields self-check');
