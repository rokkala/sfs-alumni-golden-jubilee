import type { EventCatalog } from '@/lib/events/types';

/** Default min when event has no party_min column/value. Admin may set 0. */
export const DEFAULT_PARTY_MIN = 1;
export const DEFAULT_PARTY_MAX = 20;
/** One registration is for at most one alumnus; extra attendees are guests. */
export const MAX_ALUMNI_PER_REGISTRATION = 1;

export type PartyBounds = { min: number; max: number };

/** Resolve attending limits from an event; safe defaults when columns absent. */
export function eventPartyBounds(
  event?: Pick<EventCatalog, 'party_min' | 'party_max'> | null
): PartyBounds {
  let min = Math.floor(Number(event?.party_min));
  if (!Number.isFinite(min) || min < 0) min = DEFAULT_PARTY_MIN;

  let max = Math.floor(Number(event?.party_max));
  if (!Number.isFinite(max) || max < 0) max = DEFAULT_PARTY_MAX;
  if (max < min) max = min;
  return { min, max };
}

/** Clamp people attending into [min, max] (min may be 0). */
export function clampPartySize(raw: number, bounds: PartyBounds): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return bounds.min;
  if (n < bounds.min) return bounds.min;
  if (n > bounds.max) return bounds.max;
  return n;
}

export function parsePartyBound(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * Display/report split from stored total + optional alumni_count.
 * Legacy rows (no alumni_count): 1 person when total ≥ 1, rest guests.
 */
export function partySplitFromStored(
  totalRaw: number,
  alumniCount?: number | null
): { people: number; guests: number; total: number } {
  const total = Math.max(0, Math.floor(Number(totalRaw) || 0));
  const people =
    alumniCount != null && Number.isFinite(Number(alumniCount))
      ? Math.min(
          total,
          MAX_ALUMNI_PER_REGISTRATION,
          Math.max(0, Math.floor(Number(alumniCount)))
        )
      : total > 0
        ? 1
        : 0;
  return { people, guests: total - people, total };
}

/** Split people + guests so total stays within party bounds (cut guests first when over max). */
export function clampPartySplit(
  peopleRaw: number,
  guestsRaw: number,
  bounds: PartyBounds
): { people: number; guests: number; total: number } {
  let people = Math.floor(Number(peopleRaw));
  let guests = Math.floor(Number(guestsRaw));
  if (!Number.isFinite(people) || people < 0) people = 0;
  if (!Number.isFinite(guests) || guests < 0) guests = 0;
  if (people > MAX_ALUMNI_PER_REGISTRATION) people = MAX_ALUMNI_PER_REGISTRATION;

  // A normal registration includes at least the registering alumnus when min ≥ 1.
  if (bounds.min >= 1 && people < 1) people = 1;

  let total = people + guests;
  if (total > bounds.max) {
    const overflow = total - bounds.max;
    const cutGuests = Math.min(guests, overflow);
    guests -= cutGuests;
    total = people + guests;
    if (total > bounds.max) {
      people = Math.max(bounds.min >= 1 ? 1 : 0, people - (total - bounds.max));
      total = people + guests;
    }
  }
  if (total < bounds.min) {
    guests += bounds.min - total;
    total = people + guests;
  }
  return { people, guests, total };
}
