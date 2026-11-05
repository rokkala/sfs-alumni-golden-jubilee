import {
  formatGuestMealCounts,
  guestMealCounts,
  guestsFromLegacy,
  legacySummaryFromGuests,
  normalizeGuests,
  partySize,
  type GuestChoice,
} from '../registration';

export type VenuePassInput = {
  number_of_guests: number;
  lunch: boolean;
  dinner: boolean;
  parking_needed: string;
  food_preference: string | null;
  payment_status: string;
  amount_due_paise: number;
  registration_code?: string | null;
  guests?: GuestChoice[] | null;
};

export type VenuePassSummary = {
  people: number;
  meals: string;
  parking: string;
  food: string;
  paid: boolean;
  code: string | null;
};

function resolveGuests(reg: VenuePassInput): GuestChoice[] {
  const people = partySize(Number(reg.number_of_guests));
  if (Array.isArray(reg.guests) && reg.guests.length > 0) {
    return normalizeGuests(reg.guests, people);
  }
  return guestsFromLegacy(people, reg.food_preference, Boolean(reg.lunch), Boolean(reg.dinner));
}

export function venuePassSummary(reg: VenuePassInput): VenuePassSummary {
  const guests = resolveGuests(reg);
  const counts = guestMealCounts(guests);
  const summary = legacySummaryFromGuests(guests);
  const parking =
    reg.parking_needed === '2-wheeler'
      ? '2-wheeler'
      : reg.parking_needed === '4-wheeler'
        ? '4-wheeler'
        : 'No Parking needed';
  const food =
    summary.food_preference === 'mixed'
      ? 'Mixed'
      : summary.food_preference === 'non-veg'
        ? 'Non-veg'
        : summary.food_preference === 'none'
          ? 'No food'
          : 'Veg';
  return {
    people: counts.people,
    meals: formatGuestMealCounts(counts),
    parking,
    food,
    paid: reg.payment_status === 'paid' && Math.max(0, Number(reg.amount_due_paise) || 0) === 0,
    code: reg.registration_code || null,
  };
}
