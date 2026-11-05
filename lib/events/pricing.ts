import {
  normalizeGuest,
  type EventPricing,
  type GuestChoice,
} from '@/lib/registration';
import type { EventCatalog } from '@/lib/events/types';

export function eventToPricing(event: Pick<
  EventCatalog,
  'lunch_paise' | 'dinner_paise' | 'parking_2w_paise' | 'parking_4w_paise' | 'base_ticket_paise'
> & Partial<
  Pick<
    EventCatalog,
    | 'lunch_nonveg_paise'
    | 'dinner_nonveg_paise'
    | 'lunch_provided'
    | 'dinner_provided'
    | 'guest_fee_paise'
    | 'fee_batch_from'
    | 'fee_batch_to'
    | 'fee_batch_paise'
  >
>): EventPricing {
  return {
    lunch_paise: event.lunch_paise,
    dinner_paise: event.dinner_paise,
    lunch_nonveg_paise: event.lunch_nonveg_paise,
    dinner_nonveg_paise: event.dinner_nonveg_paise,
    lunch_provided: event.lunch_provided,
    dinner_provided: event.dinner_provided,
    parking_2w_paise: event.parking_2w_paise,
    parking_4w_paise: event.parking_4w_paise,
    base_ticket_paise: event.base_ticket_paise,
    guest_fee_paise: event.guest_fee_paise ?? 0,
    fee_batch_from: event.fee_batch_from ?? null,
    fee_batch_to: event.fee_batch_to ?? null,
    fee_batch_paise: event.fee_batch_paise ?? 0,
  };
}

export { effectiveBaseTicketPaise } from '@/lib/registration';

export function parseOptionalBatchYear(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1900) return null;
  return n;
}

function rupees(paise: number | null | undefined) {
  return ((paise || 0) / 100).toFixed(0);
}

function mealHasRate(vegPaise?: number, nonvegPaise?: number | null): boolean {
  const veg = Math.max(0, Number(vegPaise) || 0);
  const non =
    nonvegPaise == null || !Number.isFinite(Number(nonvegPaise))
      ? 0
      : Math.max(0, Number(nonvegPaise));
  return veg > 0 || non > 0;
}

/**
 * Meal options show when provided.
 * Pre-migration (provided unset): fall back to “any rate > 0”.
 */
export function mealIsOffered(
  provided?: boolean | null,
  vegPaise?: number,
  nonvegPaise?: number | null
): boolean {
  if (provided === true) return true;
  if (provided === false) return false;
  return mealHasRate(vegPaise, nonvegPaise);
}

/**
 * Clear meals that are not provided.
 * When only one meal is provided, auto-select it for eating guests (UI hides the checkboxes).
 */
export function clampGuestMealsToPricing(
  pricing: EventPricing,
  guests: GuestChoice[]
): GuestChoice[] {
  const lunch = mealIsOffered(
    pricing.lunch_provided,
    pricing.lunch_paise,
    pricing.lunch_nonveg_paise
  );
  const dinner = mealIsOffered(
    pricing.dinner_provided,
    pricing.dinner_paise,
    pricing.dinner_nonveg_paise
  );
  const both = lunch && dinner;
  return guests.map((g) => {
    const n = normalizeGuest(g);
    if (n.preference === 'none') {
      return { ...n, lunch: false, dinner: false };
    }
    if (both) {
      return {
        ...n,
        lunch: n.lunch,
        dinner: n.dinner,
      };
    }
    return {
      ...n,
      lunch: lunch,
      dinner: dinner,
    };
  });
}

function mealRateLine(
  name: string,
  vegPaise: number,
  nonvegPaise: number | null | undefined
): string {
  const veg = Math.max(0, Number(vegPaise) || 0);
  const non =
    nonvegPaise == null || !Number.isFinite(Number(nonvegPaise))
      ? veg
      : Math.max(0, Number(nonvegPaise));
  if (veg === 0 && non === 0) return name;
  if (non === veg) return `${name} ₹${rupees(veg)} / person`;
  return `${name} veg ₹${rupees(veg)} · non-veg ₹${rupees(non)} / person`;
}

/** One line of meal rates for provided meals (omits amount when ₹0). */
export function mealPriceSummary(event: EventPricing): string {
  const bits: string[] = [];
  if (mealIsOffered(event.lunch_provided, event.lunch_paise, event.lunch_nonveg_paise)) {
    bits.push(mealRateLine('Lunch', event.lunch_paise, event.lunch_nonveg_paise));
  }
  if (mealIsOffered(event.dinner_provided, event.dinner_paise, event.dinner_nonveg_paise)) {
    bits.push(mealRateLine('Dinner', event.dinner_paise, event.dinner_nonveg_paise));
  }
  return bits.join(' · ');
}

export function mealChoiceLabel(
  name: string,
  vegPaise: number,
  nonvegPaise: number | null | undefined,
  preference: 'veg' | 'non-veg' | 'none'
): string {
  const rate = preference === 'non-veg' && nonvegPaise != null ? nonvegPaise : vegPaise;
  const n = Math.max(0, Number(rate) || 0);
  if (n === 0) return name;
  return `${name} · ₹${rupees(n)} / person`;
}

export function parseNonNegInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/** Convert rupees (form input) to paise. */
export function rupeesToPaise(rupees: unknown): number {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
