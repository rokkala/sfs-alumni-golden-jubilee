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

/**
 * Lunch and dinner are always offered for headcount (₹0 = free, still selectable).
 * Args kept for call-site compatibility.
 */
export function mealIsOffered(
  _vegPaise?: number,
  _nonvegPaise?: number | null
): boolean {
  return true;
}

/** Normalize guest meal choices (meals stay selectable even when priced at ₹0). */
export function clampGuestMealsToPricing(
  _pricing: EventPricing,
  guests: GuestChoice[]
): GuestChoice[] {
  return guests.map((g) => normalizeGuest(g));
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
  if (veg === 0 && non === 0) return `${name} Free`;
  if (non === veg) return `${name} ₹${rupees(veg)} / person`;
  return `${name} veg ₹${rupees(veg)} · non-veg ₹${rupees(non)} / person`;
}

/** One line of meal rates (includes Free when priced at ₹0). */
export function mealPriceSummary(event: EventPricing): string {
  return [
    mealRateLine('Lunch', event.lunch_paise, event.lunch_nonveg_paise),
    mealRateLine('Dinner', event.dinner_paise, event.dinner_nonveg_paise),
  ].join(' · ');
}

export function mealChoiceLabel(
  name: string,
  vegPaise: number,
  nonvegPaise: number | null | undefined,
  preference: 'veg' | 'non-veg' | 'none'
): string {
  const rate = preference === 'non-veg' && nonvegPaise != null ? nonvegPaise : vegPaise;
  const n = Math.max(0, Number(rate) || 0);
  if (n === 0) return `${name} · Free`;
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
