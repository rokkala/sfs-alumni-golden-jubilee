import {
  guestsFromLegacy,
  legacySummaryFromGuests,
  normalizeFoodPreference,
  normalizeGuests,
  partySize,
  type FoodPreference,
  type GuestChoice,
  type ParkingNeeded,
} from '../registration';
import { parseLocation } from '../registration-fields';
import { MAX_ALUMNI_PER_REGISTRATION } from './party-bounds';

export type ExistingRegistrationRow = {
  number_of_guests: number;
  /** Alumni/people count; absent → treat as 1 when total ≥ 1. */
  alumni_count?: number | null;
  food_preference: string | null;
  parking_needed: string;
  lunch: boolean;
  dinner: boolean;
  attending: boolean;
  phone_number: string | null;
  payment_status: string;
  amount_paid_paise?: number;
  amount_due_paise?: number;
  total_cost_paise?: number;
  guests?: GuestChoice[] | null;
};

export type RegistrationProfileSnapshot = {
  full_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  batch?: number | null;
  section?: string | null;
  current_location?: string | null;
};

export type RegistrationFormChoices = {
  number_of_guests: number;
  people_count: number;
  guest_count: number;
  food_preference: FoodPreference;
  parking_needed: ParkingNeeded;
  lunch: boolean;
  dinner: boolean;
  attending: boolean;
  phone_number?: string;
  payment_status: string;
  guests: GuestChoice[];
};

export type RegistrationPrefill = {
  full_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  batch?: number;
  section: string;
  city: string;
  country: string;
  number_of_guests: number;
  people_count: number;
  guest_count: number;
  food_preference: FoodPreference;
  parking_needed: ParkingNeeded;
  lunch: boolean;
  dinner: boolean;
  attending: boolean;
  guests: GuestChoice[];
  payment_status?: string;
  amount_paid_paise?: number;
  amount_due_paise?: number;
  total_cost_paise?: number;
};

const PARKING: ParkingNeeded[] = ['none', '2-wheeler', '4-wheeler'];

function guestsForRow(row: ExistingRegistrationRow): GuestChoice[] {
  const people = partySize(Number(row.number_of_guests));
  if (Array.isArray(row.guests) && row.guests.length > 0) {
    return normalizeGuests(row.guests, people);
  }
  return guestsFromLegacy(
    people,
    row.food_preference,
    Boolean(row.lunch),
    Boolean(row.dinner)
  );
}

export function registrationChoicesFromRow(
  row: ExistingRegistrationRow | null | undefined
): RegistrationFormChoices | null {
  if (!row) return null;
  const parking = PARKING.includes(row.parking_needed as ParkingNeeded)
    ? (row.parking_needed as ParkingNeeded)
    : 'none';
  const guests = guestsForRow(row);
  const summary = legacySummaryFromGuests(guests);
  const total = guests.length;
  const people_count =
    row.alumni_count != null && Number.isFinite(Number(row.alumni_count))
      ? Math.min(
          total,
          MAX_ALUMNI_PER_REGISTRATION,
          Math.max(0, Math.floor(Number(row.alumni_count)))
        )
      : total > 0
        ? 1
        : 0;
  const guest_count = Math.max(0, total - people_count);
  return {
    number_of_guests: total,
    people_count,
    guest_count,
    food_preference: normalizeFoodPreference(
      summary.food_preference === 'mixed' ? guests[0]?.preference : summary.food_preference
    ),
    parking_needed: parking,
    lunch: summary.lunch,
    dinner: summary.dinner,
    attending: row.attending !== false,
    phone_number: row.phone_number || undefined,
    payment_status: row.payment_status,
    guests,
  };
}

/** Merge account profile + saved event registration into registration-form fields. */
export function mergeRegistrationPrefill(
  profile: RegistrationProfileSnapshot | null | undefined,
  row: ExistingRegistrationRow | null | undefined
): RegistrationPrefill {
  const choices = registrationChoicesFromRow(row);
  const loc = parseLocation(profile?.current_location || '');
  const phone = choices?.phone_number || profile?.phone_number || '';
  const guests =
    choices?.guests ??
    guestsFromLegacy(1, 'veg', false, false);
  return {
    full_name: String(profile?.full_name || '').trim(),
    last_name: String(profile?.last_name || '').trim(),
    email: String(profile?.email || '').trim(),
    phone_number: phone,
    batch: typeof profile?.batch === 'number' ? profile.batch : undefined,
    section: String(profile?.section || '').trim(),
    city: loc.city,
    country: loc.country,
    number_of_guests: guests.length,
    people_count: choices?.people_count ?? (guests.length > 0 ? 1 : 0),
    guest_count: choices?.guest_count ?? Math.max(0, guests.length - (guests.length > 0 ? 1 : 0)),
    food_preference: choices?.food_preference ?? 'veg',
    parking_needed: choices?.parking_needed ?? 'none',
    lunch: choices?.lunch ?? false,
    dinner: choices?.dinner ?? false,
    attending: choices?.attending ?? true,
    guests,
    payment_status: choices?.payment_status,
    amount_paid_paise: Math.max(0, Number(row?.amount_paid_paise) || 0),
    amount_due_paise: Math.max(0, Number(row?.amount_due_paise) || 0),
    total_cost_paise: Math.max(0, Number(row?.total_cost_paise) || 0),
  };
}
