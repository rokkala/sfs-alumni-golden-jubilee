import type { EventCatalog } from '@/lib/events/types';

/** Default min when event has no party_min column/value. Admin may set 0. */
export const DEFAULT_PARTY_MIN = 1;
export const DEFAULT_PARTY_MAX = 20;

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
