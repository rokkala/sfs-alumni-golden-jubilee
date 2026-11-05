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

const { repriceRegistration } = await import('../lib/events/reprice-math.ts');
const {
  mealChoiceLabel,
  mealIsOffered,
  mealPriceSummary,
  clampGuestMealsToPricing,
} = await import('../lib/events/pricing.ts');

const oldRates = {
  lunch_paise: 30000,
  dinner_paise: 50000,
  parking_2w_paise: 5000,
  parking_4w_paise: 20000,
  base_ticket_paise: 0,
};
const newRates = {
  ...oldRates,
  lunch_paise: 40000,
  dinner_paise: 60000,
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const paidOne = {
  number_of_guests: 1,
  lunch: true,
  dinner: true,
  parking_needed: 'none',
  amount_paid_paise: 80000,
};

const raised = repriceRegistration(newRates, paidOne);
assert(raised.total_cost_paise === 100000, 'new rates reprice 1 person lunch+dinner to 100000');
assert(raised.amount_paid_paise === 80000, 'paid amount stays');
assert(raised.amount_due_paise === 20000, 'difference becomes due');
assert(raised.payment_status === 'partial', 'paid row becomes partial when the rate goes up');

const dropped = repriceRegistration(
  { ...newRates, lunch_paise: 10000, dinner_paise: 10000 },
  paidOne
);
assert(dropped.total_cost_paise === 20000, 'lower rates reprice the total');
assert(dropped.amount_paid_paise === 80000, 'a lower rate does not reduce what was already paid');
assert(dropped.amount_due_paise === 0, 'no new due when already paid more');
assert(dropped.payment_status === 'paid', 'stays paid');

const same = repriceRegistration(oldRates, paidOne);
assert(same.total_cost_paise === 80000, 'unchanged rates keep 80000');
assert(same.payment_status === 'paid', 'still paid at the old rate');

const nonveg = repriceRegistration(
  { ...newRates, lunch_nonveg_paise: 50000, dinner_nonveg_paise: 80000 },
  { ...paidOne, food_preference: 'non-veg' }
);
assert(nonveg.total_cost_paise === 130000, 'non-veg reprice uses the non-veg meal rates');
assert(nonveg.payment_status === 'partial', 'non-veg increase leaves a balance');

const mixed = repriceRegistration(
  {
    ...oldRates,
    lunch_nonveg_paise: 45000,
    dinner_nonveg_paise: 70000,
    base_ticket_paise: 10000,
    guest_fee_paise: 10000,
  },
  {
    number_of_guests: 3,
    lunch: true,
    dinner: true,
    parking_needed: '4-wheeler',
    guests: [
      { preference: 'non-veg', lunch: true, dinner: true },
      { preference: 'veg', lunch: true, dinner: false },
      { preference: 'none', lunch: false, dinner: false },
    ],
    amount_paid_paise: 0,
  }
);
assert(mixed.total_cost_paise === 195000, 'mixed guest reprice: alumnus + guest fees + meals');

assert(mealChoiceLabel('Lunch', 40000, 55000, 'veg') === 'Lunch · ₹400 / person', 'veg meal label');
assert(
  mealChoiceLabel('Lunch', 40000, 55000, 'non-veg') === 'Lunch · ₹550 / person',
  'non-veg meal label uses the admin non-veg rate'
);
assert(mealChoiceLabel('Dinner', 60000, null, 'non-veg') === 'Dinner · ₹600 / person', 'missing non-veg rate uses veg');
assert(mealChoiceLabel('Lunch', 0, 0, 'veg') === 'Lunch', '₹0 meal label has no amount');
assert(
  mealPriceSummary({ ...newRates, lunch_nonveg_paise: 50000, lunch_provided: true, dinner_provided: true }).includes(
    'Lunch veg ₹400 · non-veg ₹500'
  ),
  'event summary shows both lunch rates'
);
assert(mealIsOffered(true, 0, 0) === true, 'provided free meal is offered');
assert(mealIsOffered(false, 40000, 55000) === false, 'not-provided meal stays hidden even if priced');
assert(mealIsOffered(undefined, 40000, 55000) === true, 'legacy priced meal is offered');
assert(mealIsOffered(undefined, 0, 0) === false, 'legacy ₹0 meal is not offered');
assert(mealIsOffered(undefined, 0, 100) === true, 'legacy non-veg-only rate still offers the meal');
assert(
  mealPriceSummary({
    ...newRates,
    lunch_paise: 0,
    lunch_nonveg_paise: 0,
    lunch_provided: true,
    dinner_paise: 60000,
    dinner_nonveg_paise: null,
    dinner_provided: true,
  }) === 'Lunch · Dinner ₹600 / person',
  'summary shows free provided lunch without amount'
);
assert(
  mealPriceSummary({
    ...newRates,
    lunch_provided: false,
    dinner_provided: true,
    dinner_paise: 60000,
  }) === 'Dinner ₹600 / person',
  'summary omits meals that are not provided'
);
assert(
  JSON.stringify(
    clampGuestMealsToPricing(
      {
        ...newRates,
        lunch_paise: 0,
        lunch_nonveg_paise: 0,
        lunch_provided: true,
        dinner_provided: false,
      },
      [{ preference: 'veg', lunch: false, dinner: true }]
    )
  ) === JSON.stringify([{ preference: 'veg', lunch: true, dinner: false }]),
  'single provided meal auto-selects lunch for eating guests'
);
assert(
  JSON.stringify(
    clampGuestMealsToPricing(
      {
        ...newRates,
        lunch_provided: false,
        dinner_provided: true,
      },
      [{ preference: 'none', lunch: true, dinner: true }]
    )
  ) === JSON.stringify([{ preference: 'none', lunch: false, dinner: false }]),
  'no-food clears the single provided meal'
);
assert(
  JSON.stringify(
    clampGuestMealsToPricing(
      {
        ...newRates,
        lunch_provided: true,
        dinner_provided: true,
      },
      [{ preference: 'veg', lunch: true, dinner: false }]
    )
  ) === JSON.stringify([{ preference: 'veg', lunch: true, dinner: false }]),
  'both meals provided keeps explicit lunch/dinner choices'
);

console.log('check-reprice: PASS');

if (process.argv.includes('--apply')) {
  const { readFileSync, existsSync: envExists } = await import('fs');
  const envPath = new URL('../.env.local', import.meta.url);
  if (!envExists(fileURLToPath(envPath))) throw new Error('Missing .env.local');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  const { repriceEventRegistrations } = await import('../lib/events/reprice.ts');
  const ids = [
    '79294bc5-af00-4fc9-967e-daf3c0b8a0f4',
    'c1e6f9d9-919e-404b-933a-a536ae49b5a1',
  ];
  for (const id of ids) {
    const updated = await repriceEventRegistrations(id);
    console.log('repriced', id, updated);
  }
}
