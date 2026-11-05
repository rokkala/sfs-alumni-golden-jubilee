// lib/registration.ts

export type ParkingNeeded = '2-wheeler' | '4-wheeler' | 'none';
export type FoodPreference = 'veg' | 'non-veg' | 'none';

export type GuestChoice = {
  preference: FoodPreference;
  lunch: boolean;
  dinner: boolean;
};

export type GuestMealCounts = {
  lunchVeg: number;
  lunchNonVeg: number;
  dinnerVeg: number;
  dinnerNonVeg: number;
  noFood: number;
  people: number;
};

export function normalizeFoodPreference(value: unknown): FoodPreference {
  if (value === 'non-veg') return 'non-veg';
  if (value === 'none') return 'none';
  return 'veg';
}

export function normalizeGuest(raw: unknown): GuestChoice {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const preference = normalizeFoodPreference(row.preference ?? row.food_preference);
  if (preference === 'none') return { preference: 'none', lunch: false, dinner: false };
  return {
    preference,
    lunch: Boolean(row.lunch),
    dinner: Boolean(row.dinner),
  };
}

export function guestsFromLegacy(
  people: number,
  preference: unknown,
  lunch: boolean,
  dinner: boolean
): GuestChoice[] {
  const n = partySize(people);
  const one = normalizeGuest({ preference, lunch, dinner });
  return Array.from({ length: n }, () => ({ ...one }));
}

export function normalizeGuests(raw: unknown, fallbackPeople = 1): GuestChoice[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((g) => normalizeGuest(g));
  }
  return guestsFromLegacy(fallbackPeople, 'veg', false, false);
}

export function legacySummaryFromGuests(guests: GuestChoice[]): {
  food_preference: string;
  lunch: boolean;
  dinner: boolean;
} {
  const list = guests.length ? guests.map(normalizeGuest) : [normalizeGuest({})];
  const prefs = new Set(list.map((g) => g.preference));
  let food_preference: string;
  if (prefs.size === 1) food_preference = [...prefs][0];
  else if ([...prefs].every((p) => p === 'none')) food_preference = 'none';
  else food_preference = 'mixed';
  return {
    food_preference,
    lunch: list.some((g) => g.lunch),
    dinner: list.some((g) => g.dinner),
  };
}

export function guestMealCounts(guests: GuestChoice[]): GuestMealCounts {
  const list = guests.map(normalizeGuest);
  const counts: GuestMealCounts = {
    lunchVeg: 0,
    lunchNonVeg: 0,
    dinnerVeg: 0,
    dinnerNonVeg: 0,
    noFood: 0,
    people: list.length || 1,
  };
  for (const g of list) {
    if (g.preference === 'none') {
      counts.noFood += 1;
      continue;
    }
    if (g.lunch) {
      if (g.preference === 'non-veg') counts.lunchNonVeg += 1;
      else counts.lunchVeg += 1;
    }
    if (g.dinner) {
      if (g.preference === 'non-veg') counts.dinnerNonVeg += 1;
      else counts.dinnerVeg += 1;
    }
  }
  return counts;
}

export function formatGuestMealCounts(counts: GuestMealCounts): string {
  const bits: string[] = [];
  if (counts.lunchVeg) bits.push(`Lunch veg×${counts.lunchVeg}`);
  if (counts.lunchNonVeg) bits.push(`Lunch non-veg×${counts.lunchNonVeg}`);
  if (counts.dinnerVeg) bits.push(`Dinner veg×${counts.dinnerVeg}`);
  if (counts.dinnerNonVeg) bits.push(`Dinner non-veg×${counts.dinnerNonVeg}`);
  if (counts.noFood) bits.push(`No food×${counts.noFood}`);
  return bits.join(' · ') || 'No meals';
}

export type CostCalculationInput = {
  numberOfGuests?: number;
  lunch?: boolean;
  dinner?: boolean;
  parkingNeeded: ParkingNeeded;
  foodPreference?: FoodPreference;
  guests?: GuestChoice[];
  /** Alumni / people count (fee × alumnus rate). */
  alumniCount?: number | null;
  /** Accompanying guests (fee × guest rate). */
  guestCount?: number | null;
  /** Alumnus batch year — used for registration-fee range exceptions. */
  batch?: number | null;
};

/** Resolve people vs guests for fees. Legacy (no split) = 1 alumnus + rest guests. */
export function resolvePartySplit(
  totalPeople: number,
  alumniCount?: number | null,
  guestCount?: number | null
): { alumni: number; guests: number } {
  const total = Math.max(0, Math.floor(Number(totalPeople) || 0));
  const aSet = alumniCount != null && Number.isFinite(Number(alumniCount));
  const gSet = guestCount != null && Number.isFinite(Number(guestCount));
  if (aSet || gSet) {
    let alumni = aSet ? Math.max(0, Math.floor(Number(alumniCount))) : null;
    let guests = gSet ? Math.max(0, Math.floor(Number(guestCount))) : null;
    if (alumni != null && guests != null) {
      if (alumni + guests !== total) {
        alumni = Math.min(alumni, total);
        guests = total - alumni;
      }
      return { alumni, guests };
    }
    if (alumni != null) {
      alumni = Math.min(alumni, total);
      return { alumni, guests: total - alumni };
    }
    guests = Math.min(guests as number, total);
    return { alumni: total - guests, guests };
  }
  if (total <= 0) return { alumni: 0, guests: 0 };
  return { alumni: 1, guests: total - 1 };
}

export type EventPricing = {
  lunch_paise: number;
  dinner_paise: number;
  /** Absent means non-veg lunch uses the veg lunch rate. */
  lunch_nonveg_paise?: number | null;
  /** Absent means non-veg dinner uses the veg dinner rate. */
  dinner_nonveg_paise?: number | null;
  /** When true, lunch is offered even at ₹0 (for reporting). Absent = derive from rates. */
  lunch_provided?: boolean | null;
  /** When true, dinner is offered even at ₹0 (for reporting). Absent = derive from rates. */
  dinner_provided?: boolean | null;
  parking_2w_paise: number;
  parking_4w_paise: number;
  base_ticket_paise: number;
  /** Fee per accompanying guest. Absent/null = 0. */
  guest_fee_paise?: number | null;
  /** Inclusive batch bounds for alternate fee; both null = everyone pays base_ticket. */
  fee_batch_from?: number | null;
  fee_batch_to?: number | null;
  /** Fee for batches in range (paise); 0 allowed. Ignored when range unset. */
  fee_batch_paise?: number | null;
};

function mealRatePaise(pricing: EventPricing, meal: 'lunch' | 'dinner', foodPreference?: string): number {
  const veg = meal === 'lunch' ? pricing.lunch_paise || 0 : pricing.dinner_paise || 0;
  if (foodPreference !== 'non-veg') return veg;
  const nonveg = meal === 'lunch' ? pricing.lunch_nonveg_paise : pricing.dinner_nonveg_paise;
  if (nonveg == null || !Number.isFinite(Number(nonveg))) return veg;
  return Math.max(0, Number(nonveg));
}

function batchInFeeRange(
  fromRaw: number | null | undefined,
  toRaw: number | null | undefined,
  batch?: number | null
): boolean {
  const fromSet = fromRaw != null && Number.isFinite(Number(fromRaw));
  const toSet = toRaw != null && Number.isFinite(Number(toRaw));
  if (!fromSet && !toSet) return false;
  if (batch == null || !Number.isFinite(Number(batch))) return false;
  const batchYear = Math.floor(Number(batch));
  if (fromSet && toSet) {
    const lo = Math.min(Number(fromRaw), Number(toRaw));
    const hi = Math.max(Number(fromRaw), Number(toRaw));
    return batchYear >= lo && batchYear <= hi;
  }
  const only = fromSet ? Number(fromRaw) : Number(toRaw);
  return batchYear === only;
}

/**
 * Alumnus registration fee (once per registration).
 * No range → base_ticket_paise (may be 0).
 * With range → fee_batch_paise in range (may be 0), else base_ticket_paise.
 */
export function effectiveBaseTicketPaise(
  pricing: Pick<
    EventPricing,
    'base_ticket_paise' | 'fee_batch_from' | 'fee_batch_to' | 'fee_batch_paise'
  >,
  batch?: number | null
): number {
  const defaultRate = Math.max(0, Number(pricing.base_ticket_paise) || 0);
  const fromRaw = pricing.fee_batch_from;
  const toRaw = pricing.fee_batch_to;
  const fromSet = fromRaw != null && Number.isFinite(Number(fromRaw));
  const toSet = toRaw != null && Number.isFinite(Number(toRaw));
  if (!fromSet && !toSet) return defaultRate;
  if (batchInFeeRange(fromRaw, toRaw, batch)) {
    return Math.max(0, Number(pricing.fee_batch_paise) || 0);
  }
  return defaultRate;
}

/** @deprecated Prefer event catalog rates; kept for interim call sites. */
export const DEFAULT_JUBILEE_PRICING: EventPricing = {
  lunch_paise: 30000,
  dinner_paise: 50000,
  parking_2w_paise: 5000,
  parking_4w_paise: 20000,
  base_ticket_paise: 0,
};

export function calculateEventRegistrationCost(
  pricing: EventPricing,
  input: CostCalculationInput
): number {
  return getEventCostBreakdown(pricing, input).totalCost;
}

/** People attending, including the alumnus. Blank or zero still counts as one person. */
export function partySize(numberOfGuests: number): number {
  const n = Math.floor(Number(numberOfGuests));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function resolveGuests(input: CostCalculationInput): GuestChoice[] {
  if (Array.isArray(input.guests) && input.guests.length > 0) {
    return input.guests.map(normalizeGuest);
  }
  return guestsFromLegacy(
    input.numberOfGuests ?? 1,
    input.foodPreference ?? 'veg',
    Boolean(input.lunch),
    Boolean(input.dinner)
  );
}

function guestsForPricing(_pricing: EventPricing, input: CostCalculationInput): GuestChoice[] {
  return resolveGuests(input).map(normalizeGuest);
}

export function getEventCostBreakdown(
  pricing: EventPricing,
  input: CostCalculationInput
): {
  mealCost: number;
  parkingCost: number;
  baseCost: number;
  guestCost: number;
  totalCost: number;
  details: string;
} {
  const guests = guestsForPricing(pricing, input);
  const totalPeople = guests.length;
  let mealCost = 0;

  for (const g of guests) {
    if (g.preference === 'none') continue;
    if (g.lunch) mealCost += mealRatePaise(pricing, 'lunch', g.preference);
    if (g.dinner) mealCost += mealRatePaise(pricing, 'dinner', g.preference);
  }

  const parkingCost =
    input.parkingNeeded === '2-wheeler'
      ? pricing.parking_2w_paise || 0
      : input.parkingNeeded === '4-wheeler'
        ? pricing.parking_4w_paise || 0
        : 0;

  const baseRate = effectiveBaseTicketPaise(pricing, input.batch);
  const split = resolvePartySplit(totalPeople, input.alumniCount, input.guestCount);
  const baseCost = split.alumni * baseRate;
  const guestRate = Math.max(0, Number(pricing.guest_fee_paise) || 0);
  const guestCost = split.guests * guestRate;
  const counts = guestMealCounts(guests);

  const mealBits: string[] = [];
  if (counts.lunchVeg) {
    mealBits.push(`Lunch veg×${counts.lunchVeg} ₹${(mealRatePaise(pricing, 'lunch', 'veg') / 100).toFixed(0)}`);
  }
  if (counts.lunchNonVeg) {
    mealBits.push(
      `Lunch non-veg×${counts.lunchNonVeg} ₹${(mealRatePaise(pricing, 'lunch', 'non-veg') / 100).toFixed(0)}`
    );
  }
  if (counts.dinnerVeg) {
    mealBits.push(
      `Dinner veg×${counts.dinnerVeg} ₹${(mealRatePaise(pricing, 'dinner', 'veg') / 100).toFixed(0)}`
    );
  }
  if (counts.dinnerNonVeg) {
    mealBits.push(
      `Dinner non-veg×${counts.dinnerNonVeg} ₹${(mealRatePaise(pricing, 'dinner', 'non-veg') / 100).toFixed(0)}`
    );
  }

  const partyLabel = `${split.alumni} people · ${split.guests} guests`;
  let details =
    mealBits.length > 0
      ? `${partyLabel} · ${mealBits.join(' · ')}`
      : `${partyLabel} · No meals`;
  if (parkingCost > 0) {
    details += ` · parking ₹${(parkingCost / 100).toFixed(0)}`;
  }
  if (baseRate > 0 && split.alumni > 0) {
    details += ` · registration fee ₹${(baseRate / 100).toFixed(0)} ×${split.alumni}`;
  }
  if (guestCost > 0) {
    details += ` · guest fee ₹${(guestRate / 100).toFixed(0)} ×${split.guests}`;
  }

  return {
    mealCost,
    parkingCost,
    baseCost,
    guestCost,
    totalCost: mealCost + parkingCost + baseCost + guestCost,
    details,
  };
}

/** Legacy wrapper using Jubilee defaults. */
export function calculateRegistrationCost(input: CostCalculationInput): number {
  return calculateEventRegistrationCost(DEFAULT_JUBILEE_PRICING, input);
}

export function getCostBreakdown(input: CostCalculationInput) {
  const b = getEventCostBreakdown(DEFAULT_JUBILEE_PRICING, input);
  return {
    mealCost: b.mealCost,
    parkingCost: b.parkingCost,
    guestCost: b.guestCost,
    totalCost: b.totalCost,
    details: b.details,
  };
}

export function formatCostForDisplay(costInPaise: number): string {
  const rupees = costInPaise / 100;
  return `₹${rupees.toFixed(2)}`;
}

export function validateRegistrationCost(
  pricingOrInput: EventPricing | CostCalculationInput,
  maybeInput?: CostCalculationInput
): boolean {
  const pricing = maybeInput ? (pricingOrInput as EventPricing) : DEFAULT_JUBILEE_PRICING;
  const input = maybeInput ?? (pricingOrInput as CostCalculationInput);
  // Stay aligned with the calculator — any positive total is enough.
  if (getEventCostBreakdown(pricing, input).totalCost > 0) return true;

  const guests = guestsForPricing(pricing, input);
  const hasMeal = guests.some((g) => g.lunch || g.dinner);
  const hasParking = input.parkingNeeded !== 'none';
  if (hasMeal || hasParking) return true;

  // Batch in an explicit fee range (amount may be ₹0) — allow that free/reduced ticket.
  const fromRaw = pricing.fee_batch_from;
  const toRaw = pricing.fee_batch_to;
  const rangeSet =
    (fromRaw != null && Number.isFinite(Number(fromRaw))) ||
    (toRaw != null && Number.isFinite(Number(toRaw)));
  if (rangeSet && batchInFeeRange(fromRaw, toRaw, input.batch)) return true;

  // Fee-only / free event with no meal or parking choice is still a valid registration.
  const feeOnly =
    Math.max(0, Number(pricing.base_ticket_paise) || 0) === 0 &&
    Math.max(0, Number(pricing.lunch_paise) || 0) === 0 &&
    Math.max(0, Number(pricing.dinner_paise) || 0) === 0 &&
    (pricing.lunch_nonveg_paise == null || Number(pricing.lunch_nonveg_paise) === 0) &&
    (pricing.dinner_nonveg_paise == null || Number(pricing.dinner_nonveg_paise) === 0);
  if (feeOnly) return true;

  return false;
}
