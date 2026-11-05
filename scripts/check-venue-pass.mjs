import { registerHooks } from 'node:module';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith('@/')) spec = pathToFileURL(path.join(root, spec.slice(2))).href;
    if (spec.startsWith('.')) {
      const parent = context.parentURL ? fileURLToPath(context.parentURL) : root;
      const abs = path.resolve(path.dirname(parent), spec);
      if (!path.extname(abs) && existsSync(`${abs}.ts`)) spec = pathToFileURL(`${abs}.ts`).href;
    } else if (spec.startsWith('file:')) {
      const abs = fileURLToPath(spec);
      if (!path.extname(abs) && existsSync(`${abs}.ts`)) spec = pathToFileURL(`${abs}.ts`).href;
    }
    return nextResolve(spec, context);
  },
});

const { venuePassSummary } = await import('../lib/events/venue-pass.ts');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const paid = venuePassSummary({
  number_of_guests: 2,
  lunch: true,
  dinner: true,
  parking_needed: '4-wheeler',
  food_preference: 'veg',
  payment_status: 'paid',
  amount_due_paise: 0,
  registration_code: 'SFS-4K7M2',
});
assert(paid.paid === true, 'fully paid pass is paid');
assert(paid.code === 'SFS-4K7M2', 'paid pass keeps the registration id');
assert(paid.people === 2, 'people count is the party size');
assert(paid.meals === 'Lunch veg×2 · Dinner veg×2', 'both meals are listed with counts');
assert(paid.parking === '4-wheeler', 'parking is shown');
assert(paid.food === 'Veg', 'veg preference is shown');

const owed = venuePassSummary({
  number_of_guests: 1,
  lunch: false,
  dinner: false,
  parking_needed: 'none',
  food_preference: 'non-veg',
  payment_status: 'partial',
  amount_due_paise: 20000,
  registration_code: 'SFS-KEEP1',
});
assert(owed.paid === false, 'a balance is not a paid pass');
assert(owed.code === 'SFS-KEEP1', 'an existing id still shows so staff can look it up');
assert(owed.meals === 'No meals', 'missing meals are explicit');
assert(owed.parking === 'No Parking needed', 'no parking is explicit');
assert(owed.food === 'Non-veg', 'non-veg preference is shown');

const noFood = venuePassSummary({
  number_of_guests: 1,
  lunch: false,
  dinner: false,
  parking_needed: '2-wheeler',
  food_preference: 'none',
  payment_status: 'paid',
  amount_due_paise: 0,
  registration_code: 'SFS-NOFD1',
});
assert(noFood.food === 'No food', 'none preference shows as No food');
assert(noFood.meals === 'No food×1', 'no-food pass counts no food');

const mixed = venuePassSummary({
  number_of_guests: 2,
  lunch: true,
  dinner: false,
  parking_needed: 'none',
  food_preference: 'veg',
  payment_status: 'paid',
  amount_due_paise: 0,
  guests: [
    { preference: 'veg', lunch: true, dinner: false },
    { preference: 'non-veg', lunch: true, dinner: false },
  ],
});
assert(mixed.food === 'Mixed', 'mixed diets show Mixed');
assert(mixed.meals.includes('Lunch veg×1'), 'mixed lists lunch veg');
assert(mixed.meals.includes('Lunch non-veg×1'), 'mixed lists lunch non-veg');

console.log('check-venue-pass: PASS');
